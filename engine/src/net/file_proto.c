#include "file_proto.h"
#include "io.h"
#include "log.h"

#include "sftp_protocol_builder.h"

#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

static int fp_finalize_and_send(flatcc_builder_t* b, int fd) {
    size_t sz;
    uint8_t* buf = (uint8_t*)flatcc_builder_finalize_buffer(b, &sz);
    int ret = nexterm_send_frame(fd, buf, sz, NULL);
    flatcc_builder_clear(b);
    free(buf);
    return ret;
}

int fp_entries_push(fp_entries_t* list, const char* name, bool is_dir,
                    bool is_symlink, uint64_t size, uint32_t mtime, uint32_t mode) {
    if (list->count == list->cap) {
        size_t new_cap = list->cap ? list->cap * 2 : 64;
        fp_entry_t* items = realloc(list->items, new_cap * sizeof(fp_entry_t));
        if (!items) return -1;
        list->items = items;
        list->cap = new_cap;
    }

    fp_entry_t* e = &list->items[list->count];
    e->name = strdup(name);
    if (!e->name) return -1;
    e->is_dir = is_dir;
    e->is_symlink = is_symlink;
    e->size = size;
    e->mtime = mtime;
    e->mode = mode;
    list->count++;
    return 0;
}

void fp_entries_free(fp_entries_t* list) {
    for (size_t i = 0; i < list->count; i++)
        free(list->items[i].name);
    free(list->items);
    list->items = NULL;
    list->count = 0;
    list->cap = 0;
}

static void fp_start_message(flatcc_builder_t* b,
                             Nexterm_SftpProtocol_SftpMsgType_enum_t type,
                             uint32_t rid) {
    flatcc_builder_init(b);
    Nexterm_SftpProtocol_SftpMessage_start_as_root(b);
    Nexterm_SftpProtocol_SftpMessage_msg_type_add(b, type);
    Nexterm_SftpProtocol_SftpMessage_request_id_add(b, rid);
}

int fp_send_ready(int fd) {
    flatcc_builder_t b;
    fp_start_message(&b, Nexterm_SftpProtocol_SftpMsgType_Ready, 0);
    Nexterm_SftpProtocol_SftpMessage_end_as_root(&b);
    return fp_finalize_and_send(&b, fd);
}

int fp_send_ok(int fd, uint32_t rid) {
    flatcc_builder_t b;
    fp_start_message(&b, Nexterm_SftpProtocol_SftpMsgType_Ok, rid);
    Nexterm_SftpProtocol_SftpMessage_end_as_root(&b);
    return fp_finalize_and_send(&b, fd);
}

int fp_send_error(int fd, uint32_t rid, const char* message, int32_t code) {
    flatcc_builder_t b;
    fp_start_message(&b, Nexterm_SftpProtocol_SftpMsgType_Error, rid);
    Nexterm_SftpProtocol_SftpMessage_error_res_start(&b);
    Nexterm_SftpProtocol_ErrorRes_message_create_str(&b, message);
    Nexterm_SftpProtocol_ErrorRes_code_add(&b, code);
    Nexterm_SftpProtocol_SftpMessage_error_res_end(&b);
    Nexterm_SftpProtocol_SftpMessage_end_as_root(&b);
    return fp_finalize_and_send(&b, fd);
}

int fp_send_file_data(int fd, uint32_t rid, const uint8_t* data, size_t len,
                      uint64_t total_size) {
    flatcc_builder_t b;
    fp_start_message(&b, Nexterm_SftpProtocol_SftpMsgType_FileData, rid);
    Nexterm_SftpProtocol_SftpMessage_file_data_res_start(&b);
    Nexterm_SftpProtocol_FileDataRes_data_create(&b, data, len);
    Nexterm_SftpProtocol_FileDataRes_total_size_add(&b, total_size);
    Nexterm_SftpProtocol_SftpMessage_file_data_res_end(&b);
    Nexterm_SftpProtocol_SftpMessage_end_as_root(&b);
    return fp_finalize_and_send(&b, fd);
}

int fp_send_file_end(int fd, uint32_t rid) {
    flatcc_builder_t b;
    fp_start_message(&b, Nexterm_SftpProtocol_SftpMsgType_FileEnd, rid);
    Nexterm_SftpProtocol_SftpMessage_end_as_root(&b);
    return fp_finalize_and_send(&b, fd);
}

int fp_send_thumbnail(int fd, uint32_t rid, const uint8_t* data, size_t len,
                      uint32_t w, uint32_t h) {
    flatcc_builder_t b;
    fp_start_message(&b, Nexterm_SftpProtocol_SftpMsgType_ThumbnailResult, rid);
    Nexterm_SftpProtocol_SftpMessage_thumbnail_res_start(&b);
    Nexterm_SftpProtocol_ThumbnailRes_data_create(&b, data, len);
    Nexterm_SftpProtocol_ThumbnailRes_width_add(&b, w);
    Nexterm_SftpProtocol_ThumbnailRes_height_add(&b, h);
    Nexterm_SftpProtocol_SftpMessage_thumbnail_res_end(&b);
    Nexterm_SftpProtocol_SftpMessage_end_as_root(&b);
    return fp_finalize_and_send(&b, fd);
}

int fp_send_dir_list(int fd, uint32_t rid, const fp_entries_t* list) {
    flatcc_builder_t b;
    fp_start_message(&b, Nexterm_SftpProtocol_SftpMsgType_DirList, rid);
    Nexterm_SftpProtocol_SftpMessage_dir_list_res_start(&b);
    Nexterm_SftpProtocol_DirListRes_entries_start(&b);

    for (size_t i = 0; i < list->count; i++) {
        const fp_entry_t* e = &list->items[i];
        Nexterm_SftpProtocol_DirListRes_entries_push_start(&b);
        Nexterm_SftpProtocol_DirEntry_name_create_str(&b, e->name);
        Nexterm_SftpProtocol_DirEntry_is_dir_add(&b, e->is_dir);
        Nexterm_SftpProtocol_DirEntry_is_symlink_add(&b, e->is_symlink);
        Nexterm_SftpProtocol_DirEntry_size_add(&b, e->size);
        Nexterm_SftpProtocol_DirEntry_mtime_add(&b, e->mtime);
        Nexterm_SftpProtocol_DirEntry_mode_add(&b, e->mode);
        Nexterm_SftpProtocol_DirListRes_entries_push_end(&b);
    }

    Nexterm_SftpProtocol_DirListRes_entries_end(&b);
    Nexterm_SftpProtocol_SftpMessage_dir_list_res_end(&b);
    Nexterm_SftpProtocol_SftpMessage_end_as_root(&b);
    return fp_finalize_and_send(&b, fd);
}

int fp_send_stat(int fd, uint32_t rid, const fp_stat_t* st) {
    flatcc_builder_t b;
    fp_start_message(&b, Nexterm_SftpProtocol_SftpMsgType_StatResult, rid);
    Nexterm_SftpProtocol_SftpMessage_stat_res_start(&b);
    Nexterm_SftpProtocol_StatRes_size_add(&b, st->size);
    Nexterm_SftpProtocol_StatRes_mode_add(&b, st->mode);
    Nexterm_SftpProtocol_StatRes_uid_add(&b, st->uid);
    Nexterm_SftpProtocol_StatRes_gid_add(&b, st->gid);
    Nexterm_SftpProtocol_StatRes_atime_add(&b, st->atime);
    Nexterm_SftpProtocol_StatRes_mtime_add(&b, st->mtime);
    Nexterm_SftpProtocol_StatRes_owner_create_str(&b, st->owner);
    Nexterm_SftpProtocol_StatRes_group_create_str(&b, st->group);
    Nexterm_SftpProtocol_StatRes_is_dir_add(&b, st->is_dir);
    Nexterm_SftpProtocol_SftpMessage_stat_res_end(&b);
    Nexterm_SftpProtocol_SftpMessage_end_as_root(&b);
    return fp_finalize_and_send(&b, fd);
}

int fp_send_realpath(int fd, uint32_t rid, const char* path, bool is_dir) {
    flatcc_builder_t b;
    fp_start_message(&b, Nexterm_SftpProtocol_SftpMsgType_RealpathResult, rid);
    Nexterm_SftpProtocol_SftpMessage_realpath_res_start(&b);
    Nexterm_SftpProtocol_RealpathRes_path_create_str(&b, path);
    Nexterm_SftpProtocol_RealpathRes_is_dir_add(&b, is_dir);
    Nexterm_SftpProtocol_SftpMessage_realpath_res_end(&b);
    Nexterm_SftpProtocol_SftpMessage_end_as_root(&b);
    return fp_finalize_and_send(&b, fd);
}

int fp_send_exec_result(int fd, uint32_t rid, const char* stdout_data,
                        const char* stderr_data, int32_t exit_code) {
    flatcc_builder_t b;
    fp_start_message(&b, Nexterm_SftpProtocol_SftpMsgType_ExecResult, rid);
    Nexterm_SftpProtocol_SftpMessage_exec_res_start(&b);
    Nexterm_SftpProtocol_ExecRes_stdout_data_create_str(&b, stdout_data);
    Nexterm_SftpProtocol_ExecRes_stderr_data_create_str(&b, stderr_data);
    Nexterm_SftpProtocol_ExecRes_exit_code_add(&b, exit_code);
    Nexterm_SftpProtocol_SftpMessage_exec_res_end(&b);
    Nexterm_SftpProtocol_SftpMessage_end_as_root(&b);
    return fp_finalize_and_send(&b, fd);
}

int fp_send_search_result(int fd, uint32_t rid, const fp_search_t* ctx) {
    flatcc_builder_t b;
    fp_start_message(&b, Nexterm_SftpProtocol_SftpMsgType_SearchResult, rid);
    Nexterm_SftpProtocol_SftpMessage_search_res_start(&b);
    Nexterm_SftpProtocol_SearchRes_directories_start(&b);
    for (int i = 0; i < ctx->count; i++)
        Nexterm_SftpProtocol_SearchRes_directories_push_create_str(&b, ctx->paths[i]);
    Nexterm_SftpProtocol_SearchRes_directories_end(&b);
    Nexterm_SftpProtocol_SftpMessage_search_res_end(&b);
    Nexterm_SftpProtocol_SftpMessage_end_as_root(&b);
    return fp_finalize_and_send(&b, fd);
}

int64_t fp_monotonic_ms(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (int64_t)ts.tv_sec * 1000 + ts.tv_nsec / 1000000;
}

bool fp_name_matches(const char* name, const char* search_term) {
    size_t tlen = strlen(search_term);
    if (tlen == 0) return true;
    if (strlen(name) < tlen) return false;

    for (size_t i = 0; i < tlen; i++) {
        if (tolower((unsigned char)name[i]) != tolower((unsigned char)search_term[i]))
            return false;
    }
    return true;
}

void fp_parse_search_path(const char* search_path, char* base_path, size_t base_sz,
                          char* search_term, size_t term_sz, bool* inside) {
    size_t sp_len = strlen(search_path);
    *inside = (sp_len > 0 && search_path[sp_len - 1] == '/');

    if (*inside) {
        if (sp_len == 1) {
            snprintf(base_path, base_sz, "/");
        } else {
            snprintf(base_path, base_sz, "%s", search_path);
            size_t copied = strlen(base_path);
            if (copied > 0) base_path[copied - 1] = '\0';
        }
        search_term[0] = '\0';
    } else {
        const char* last_slash = strrchr(search_path, '/');
        if (!last_slash || last_slash == search_path) {
            snprintf(base_path, base_sz, "/");
            if (last_slash == search_path && sp_len > 1)
                snprintf(search_term, term_sz, "%s", search_path + 1);
            else if (!last_slash)
                snprintf(search_term, term_sz, "%s", search_path);
            else
                search_term[0] = '\0';
        } else {
            size_t base_len = (size_t)(last_slash - search_path);
            if (base_len >= base_sz) base_len = base_sz - 1;
            memcpy(base_path, search_path, base_len);
            base_path[base_len] = '\0';
            snprintf(search_term, term_sz, "%s", last_slash + 1);
        }
    }

    for (char* p = search_term; *p; p++)
        *p = (char)tolower((unsigned char)*p);
}

void fp_join_path(const char* base, const char* name, char* out, size_t out_sz) {
    if (strcmp(base, "/") == 0)
        snprintf(out, out_sz, "/%s", name);
    else
        snprintf(out, out_sz, "%s/%s", base, name);
}
