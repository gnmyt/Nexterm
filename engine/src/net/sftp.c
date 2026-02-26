#include "sftp.h"
#include "ssh_common.h"
#include "control_plane.h"
#include "io.h"
#include "log.h"

#include <libssh2.h>
#include <libssh2_sftp.h>

#include "sftp_protocol_builder.h"
#include "sftp_protocol_reader.h"

#include <ctype.h>
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#define SFTP_CHUNK_SIZE    32768
#define SFTP_MAX_PATH      4096
#define SFTP_MAX_FRAME     (16 * 1024 * 1024)
#define SFTP_SEARCH_DEPTH  3
#define SFTP_SEARCH_MAX    20
#define SFTP_EXEC_BUF      (256 * 1024)

typedef struct {
    nexterm_session_t* session;
    nexterm_control_plane_t* cp;
} sftp_thread_args_t;

static int sftp_finalize_and_send(flatcc_builder_t* b, int fd) {
    size_t sz;
    uint8_t* buf = (uint8_t*)flatcc_builder_finalize_buffer(b, &sz);
    int ret = nexterm_send_frame(fd, buf, sz, NULL);
    flatcc_builder_clear(b);
    free(buf);
    return ret;
}

static const char* sftp_strerror(unsigned long err) {
    switch (err) {
        case LIBSSH2_FX_NO_SUCH_FILE:       return "Path does not exist";
        case LIBSSH2_FX_PERMISSION_DENIED:   return "Permission denied";
        case LIBSSH2_FX_FAILURE:             return "Operation failed";
        case LIBSSH2_FX_NO_SUCH_PATH:        return "Path does not exist";
        case LIBSSH2_FX_FILE_ALREADY_EXISTS: return "Already exists";
        case LIBSSH2_FX_WRITE_PROTECT:       return "Write protected";
        case LIBSSH2_FX_NO_MEDIA:            return "No media";
        case LIBSSH2_FX_NO_SPACE_ON_FILESYSTEM: return "No space left";
        case LIBSSH2_FX_QUOTA_EXCEEDED:      return "Quota exceeded";
        default:                             return "SFTP error";
    }
}

static int send_ready(int fd) {
    flatcc_builder_t b;
    flatcc_builder_init(&b);

    Nexterm_SftpProtocol_SftpMessage_start_as_root(&b);
    Nexterm_SftpProtocol_SftpMessage_msg_type_add(&b, Nexterm_SftpProtocol_SftpMsgType_Ready);
    Nexterm_SftpProtocol_SftpMessage_request_id_add(&b, 0);
    Nexterm_SftpProtocol_SftpMessage_end_as_root(&b);

    return sftp_finalize_and_send(&b, fd);
}

static int send_ok(int fd, uint32_t rid) {
    flatcc_builder_t b;
    flatcc_builder_init(&b);

    Nexterm_SftpProtocol_SftpMessage_start_as_root(&b);
    Nexterm_SftpProtocol_SftpMessage_msg_type_add(&b, Nexterm_SftpProtocol_SftpMsgType_Ok);
    Nexterm_SftpProtocol_SftpMessage_request_id_add(&b, rid);
    Nexterm_SftpProtocol_SftpMessage_end_as_root(&b);

    return sftp_finalize_and_send(&b, fd);
}

static int send_error(int fd, uint32_t rid, const char* message, int32_t code) {
    flatcc_builder_t b;
    flatcc_builder_init(&b);

    Nexterm_SftpProtocol_SftpMessage_start_as_root(&b);
    Nexterm_SftpProtocol_SftpMessage_msg_type_add(&b, Nexterm_SftpProtocol_SftpMsgType_Error);
    Nexterm_SftpProtocol_SftpMessage_request_id_add(&b, rid);
    Nexterm_SftpProtocol_SftpMessage_error_res_start(&b);
    Nexterm_SftpProtocol_ErrorRes_message_create_str(&b, message);
    Nexterm_SftpProtocol_ErrorRes_code_add(&b, code);
    Nexterm_SftpProtocol_SftpMessage_error_res_end(&b);
    Nexterm_SftpProtocol_SftpMessage_end_as_root(&b);

    return sftp_finalize_and_send(&b, fd);
}

static int send_file_data(int fd, uint32_t rid, const uint8_t* data,
                          size_t len, uint64_t total_size) {
    flatcc_builder_t b;
    flatcc_builder_init(&b);

    Nexterm_SftpProtocol_SftpMessage_start_as_root(&b);
    Nexterm_SftpProtocol_SftpMessage_msg_type_add(&b, Nexterm_SftpProtocol_SftpMsgType_FileData);
    Nexterm_SftpProtocol_SftpMessage_request_id_add(&b, rid);
    Nexterm_SftpProtocol_SftpMessage_file_data_res_start(&b);
    Nexterm_SftpProtocol_FileDataRes_data_create(&b, data, len);
    Nexterm_SftpProtocol_FileDataRes_total_size_add(&b, total_size);
    Nexterm_SftpProtocol_SftpMessage_file_data_res_end(&b);
    Nexterm_SftpProtocol_SftpMessage_end_as_root(&b);

    return sftp_finalize_and_send(&b, fd);
}

static int send_file_end(int fd, uint32_t rid) {
    flatcc_builder_t b;
    flatcc_builder_init(&b);

    Nexterm_SftpProtocol_SftpMessage_start_as_root(&b);
    Nexterm_SftpProtocol_SftpMessage_msg_type_add(&b, Nexterm_SftpProtocol_SftpMsgType_FileEnd);
    Nexterm_SftpProtocol_SftpMessage_request_id_add(&b, rid);
    Nexterm_SftpProtocol_SftpMessage_end_as_root(&b);

    return sftp_finalize_and_send(&b, fd);
}

static int exec_command(LIBSSH2_SESSION* ssh, const char* cmd,
                        char* out, size_t out_sz,
                        char* err_buf, size_t err_sz,
                        int* exit_code) {
    LIBSSH2_CHANNEL* ch = libssh2_channel_open_session(ssh);
    if (!ch) return -1;

    if (libssh2_channel_exec(ch, cmd) != 0) {
        libssh2_channel_free(ch);
        return -1;
    }

    nexterm_ssh_read_stream(ch, out, out_sz, 0);
    nexterm_ssh_read_stream(ch, err_buf, err_sz, 1);

    libssh2_channel_close(ch);
    libssh2_channel_wait_closed(ch);
    *exit_code = libssh2_channel_get_exit_status(ch);
    libssh2_channel_free(ch);
    return 0;
}

static int recursive_rmdir(LIBSSH2_SFTP* sftp, const char* path) {
    LIBSSH2_SFTP_HANDLE* dir = libssh2_sftp_opendir(sftp, path);
    if (!dir) return -1;

    char name[512];
    char longentry[512];
    LIBSSH2_SFTP_ATTRIBUTES attrs;
    char fullpath[SFTP_MAX_PATH];

    while (libssh2_sftp_readdir_ex(dir, name, sizeof(name),
                                    longentry, sizeof(longentry), &attrs) > 0) {
        if (strcmp(name, ".") == 0 || strcmp(name, "..") == 0) continue;

        if (strcmp(path, "/") == 0)
            snprintf(fullpath, sizeof(fullpath), "/%s", name);
        else
            snprintf(fullpath, sizeof(fullpath), "%s/%s", path, name);

        if (longentry[0] == 'd')
            recursive_rmdir(sftp, fullpath);
        else
            libssh2_sftp_unlink(sftp, fullpath);
    }

    libssh2_sftp_closedir(dir);
    return libssh2_sftp_rmdir(sftp, path);
}

typedef struct {
    char paths[SFTP_SEARCH_MAX][SFTP_MAX_PATH];
    int count;
    int max_results;
} search_ctx_t;

static bool search_name_matches(const char* name, const char* search_term) {
    size_t tlen = strlen(search_term);
    if (tlen == 0) return true;
    if (strlen(name) < tlen) return false;

    for (size_t i = 0; i < tlen; i++) {
        if (tolower((unsigned char)name[i]) != tolower((unsigned char)search_term[i]))
            return false;
    }
    return true;
}

static void search_check_entry(const char* fullpath, const char* name,
                                const char* current, const char* search_term,
                                bool inside, const char* base_path,
                                search_ctx_t* ctx) {
    bool match = false;
    if (inside)
        match = (strcmp(current, base_path) == 0);
    else
        match = search_name_matches(name, search_term);

    if (match && ctx->count < ctx->max_results) {
        snprintf(ctx->paths[ctx->count], SFTP_MAX_PATH, "%s", fullpath);
        ctx->count++;
    }
}

static void search_recursive(LIBSSH2_SFTP* sftp, const char* current,
                              const char* search_term, bool inside,
                              const char* base_path,
                              search_ctx_t* ctx, int depth) {
    if (depth > SFTP_SEARCH_DEPTH || ctx->count >= ctx->max_results) return;

    LIBSSH2_SFTP_HANDLE* dir = libssh2_sftp_opendir(sftp, current);
    if (!dir) return;

    char name[512];
    char longentry[512];
    LIBSSH2_SFTP_ATTRIBUTES attrs;
    char fullpath[SFTP_MAX_PATH];

    while (ctx->count < ctx->max_results &&
           libssh2_sftp_readdir_ex(dir, name, sizeof(name),
                                    longentry, sizeof(longentry), &attrs) > 0) {
        if (strcmp(name, ".") == 0 || strcmp(name, "..") == 0) continue;
        if (longentry[0] != 'd') continue;

        if (strcmp(current, "/") == 0)
            snprintf(fullpath, sizeof(fullpath), "/%s", name);
        else
            snprintf(fullpath, sizeof(fullpath), "%s/%s", current, name);

        search_check_entry(fullpath, name, current, search_term,
                           inside, base_path, ctx);

        if (depth < SFTP_SEARCH_DEPTH && ctx->count < ctx->max_results)
            search_recursive(sftp, fullpath, search_term, inside,
                             base_path, ctx, depth + 1);
    }

    libssh2_sftp_closedir(dir);
}

static void handle_list_dir(LIBSSH2_SFTP* sftp, int fd, uint32_t rid,
                            const char* path) {
    LIBSSH2_SFTP_HANDLE* dir = libssh2_sftp_opendir(sftp, path);
    if (!dir) {
        unsigned long e = libssh2_sftp_last_error(sftp);
        send_error(fd, rid, sftp_strerror(e), (int32_t)e);
        return;
    }

    flatcc_builder_t b;
    flatcc_builder_init(&b);

    Nexterm_SftpProtocol_SftpMessage_start_as_root(&b);
    Nexterm_SftpProtocol_SftpMessage_msg_type_add(&b, Nexterm_SftpProtocol_SftpMsgType_DirList);
    Nexterm_SftpProtocol_SftpMessage_request_id_add(&b, rid);
    Nexterm_SftpProtocol_SftpMessage_dir_list_res_start(&b);
    Nexterm_SftpProtocol_DirListRes_entries_start(&b);

    char name[512];
    char longentry[512];
    LIBSSH2_SFTP_ATTRIBUTES attrs;

    while (libssh2_sftp_readdir_ex(dir, name, sizeof(name),
                                    longentry, sizeof(longentry), &attrs) > 0) {
        if (strcmp(name, ".") == 0 || strcmp(name, "..") == 0) continue;

        Nexterm_SftpProtocol_DirListRes_entries_push_start(&b);
        Nexterm_SftpProtocol_DirEntry_name_create_str(&b, name);
        Nexterm_SftpProtocol_DirEntry_is_dir_add(&b, longentry[0] == 'd');
        Nexterm_SftpProtocol_DirEntry_is_symlink_add(&b, longentry[0] == 'l');
        Nexterm_SftpProtocol_DirEntry_size_add(&b, attrs.filesize);
        Nexterm_SftpProtocol_DirEntry_mtime_add(&b, (uint32_t)attrs.mtime);
        Nexterm_SftpProtocol_DirEntry_mode_add(&b, (uint32_t)attrs.permissions);
        Nexterm_SftpProtocol_DirListRes_entries_push_end(&b);
    }

    Nexterm_SftpProtocol_DirListRes_entries_end(&b);
    Nexterm_SftpProtocol_SftpMessage_dir_list_res_end(&b);
    Nexterm_SftpProtocol_SftpMessage_end_as_root(&b);

    sftp_finalize_and_send(&b, fd);
    libssh2_sftp_closedir(dir);
}

static void shell_escape_path(const char* path, char* escaped, size_t escaped_sz) {
    if (escaped_sz < 6) {
        escaped[0] = '\0';
        return;
    }
    size_t ei = 0;
    size_t pi = 0;
    size_t path_len = strlen(path);
    escaped[ei++] = '\'';
    while (pi < path_len && ei + 5 < escaped_sz) {
        if (path[pi] == '\'') {
            escaped[ei++] = '\'';
            escaped[ei++] = '\\';
            escaped[ei++] = '\'';
            escaped[ei++] = '\'';
        } else {
            escaped[ei++] = path[pi];
        }
        pi++;
    }
    escaped[ei++] = '\'';
    escaped[ei] = '\0';
}

static void stat_get_owner_group(LIBSSH2_SESSION* ssh, const char* path,
                                  char* owner, size_t owner_sz,
                                  char* group, size_t group_sz) {
    owner[0] = '\0';
    group[0] = '\0';

    char escaped[SFTP_MAX_PATH * 2];
    shell_escape_path(path, escaped, sizeof(escaped));

    char cmd[SFTP_MAX_PATH * 2 + 64];
    snprintf(cmd, sizeof(cmd), "stat -c '%%U:%%G' %s 2>/dev/null || echo ':'", escaped);

    char out[256];
    char err[256];
    int ec;
    if (exec_command(ssh, cmd, out, sizeof(out), err, sizeof(err), &ec) != 0)
        return;

    size_t len = strlen(out);
    if (len > 0 && out[len - 1] == '\n') out[len - 1] = '\0';

    char* colon = strchr(out, ':');
    if (colon) {
        *colon = '\0';
        snprintf(owner, owner_sz, "%s", out);
        snprintf(group, group_sz, "%s", colon + 1);
    }
}

static void handle_stat(LIBSSH2_SFTP* sftp, LIBSSH2_SESSION* ssh,
                        int fd, uint32_t rid, const char* path) {
    LIBSSH2_SFTP_ATTRIBUTES attrs;
    if (libssh2_sftp_stat(sftp, path, &attrs) != 0) {
        unsigned long e = libssh2_sftp_last_error(sftp);
        send_error(fd, rid, sftp_strerror(e), (int32_t)e);
        return;
    }

    bool is_dir = (attrs.permissions & LIBSSH2_SFTP_S_IFMT) == LIBSSH2_SFTP_S_IFDIR;

    char owner[128];
    char group[128];
    stat_get_owner_group(ssh, path, owner, sizeof(owner), group, sizeof(group));

    flatcc_builder_t b;
    flatcc_builder_init(&b);

    Nexterm_SftpProtocol_SftpMessage_start_as_root(&b);
    Nexterm_SftpProtocol_SftpMessage_msg_type_add(&b, Nexterm_SftpProtocol_SftpMsgType_StatResult);
    Nexterm_SftpProtocol_SftpMessage_request_id_add(&b, rid);
    Nexterm_SftpProtocol_SftpMessage_stat_res_start(&b);
    Nexterm_SftpProtocol_StatRes_size_add(&b, attrs.filesize);
    Nexterm_SftpProtocol_StatRes_mode_add(&b, (uint32_t)attrs.permissions);
    Nexterm_SftpProtocol_StatRes_uid_add(&b, (uint32_t)attrs.uid);
    Nexterm_SftpProtocol_StatRes_gid_add(&b, (uint32_t)attrs.gid);
    Nexterm_SftpProtocol_StatRes_atime_add(&b, (uint32_t)attrs.atime);
    Nexterm_SftpProtocol_StatRes_mtime_add(&b, (uint32_t)attrs.mtime);
    Nexterm_SftpProtocol_StatRes_owner_create_str(&b, owner);
    Nexterm_SftpProtocol_StatRes_group_create_str(&b, group);
    Nexterm_SftpProtocol_StatRes_is_dir_add(&b, is_dir);
    Nexterm_SftpProtocol_SftpMessage_stat_res_end(&b);
    Nexterm_SftpProtocol_SftpMessage_end_as_root(&b);

    sftp_finalize_and_send(&b, fd);
}

static void handle_mkdir(LIBSSH2_SFTP* sftp, int fd, uint32_t rid,
                         const char* path) {
    if (libssh2_sftp_mkdir(sftp, path, 0755) != 0) {
        unsigned long e = libssh2_sftp_last_error(sftp);
        send_error(fd, rid, sftp_strerror(e), (int32_t)e);
    } else {
        send_ok(fd, rid);
    }
}

static void handle_rmdir(LIBSSH2_SFTP* sftp, int fd, uint32_t rid,
                         const char* path, bool recursive) {
    int rc = recursive ? recursive_rmdir(sftp, path) : libssh2_sftp_rmdir(sftp, path);
    if (rc != 0) {
        unsigned long e = libssh2_sftp_last_error(sftp);
        send_error(fd, rid, sftp_strerror(e), (int32_t)e);
    } else {
        send_ok(fd, rid);
    }
}

static void handle_unlink(LIBSSH2_SFTP* sftp, int fd, uint32_t rid,
                          const char* path) {
    if (libssh2_sftp_unlink(sftp, path) != 0) {
        unsigned long e = libssh2_sftp_last_error(sftp);
        send_error(fd, rid, sftp_strerror(e), (int32_t)e);
    } else {
        send_ok(fd, rid);
    }
}

static void handle_rename(LIBSSH2_SFTP* sftp, int fd, uint32_t rid,
                          const char* old_path, const char* new_path) {
    int rc = libssh2_sftp_rename_ex(sftp,
        old_path, (unsigned int)strlen(old_path),
        new_path, (unsigned int)strlen(new_path),
        LIBSSH2_SFTP_RENAME_OVERWRITE | LIBSSH2_SFTP_RENAME_ATOMIC |
        LIBSSH2_SFTP_RENAME_NATIVE);
    if (rc != 0) {
        unsigned long e = libssh2_sftp_last_error(sftp);
        send_error(fd, rid, sftp_strerror(e), (int32_t)e);
    } else {
        send_ok(fd, rid);
    }
}

static void handle_chmod(LIBSSH2_SFTP* sftp, int fd, uint32_t rid,
                         const char* path, uint32_t mode) {
    LIBSSH2_SFTP_ATTRIBUTES attrs;
    memset(&attrs, 0, sizeof(attrs));
    attrs.flags = LIBSSH2_SFTP_ATTR_PERMISSIONS;
    attrs.permissions = (unsigned long)mode;

    int rc = libssh2_sftp_stat_ex(sftp, path, (unsigned int)strlen(path),
                                   LIBSSH2_SFTP_SETSTAT, &attrs);
    if (rc != 0) {
        unsigned long e = libssh2_sftp_last_error(sftp);
        send_error(fd, rid, sftp_strerror(e), (int32_t)e);
    } else {
        send_ok(fd, rid);
    }
}

static void handle_realpath(LIBSSH2_SFTP* sftp, int fd, uint32_t rid,
                            const char* path) {
    char resolved[SFTP_MAX_PATH];
    int rc = libssh2_sftp_realpath(sftp, path, resolved, sizeof(resolved) - 1);
    if (rc < 0) {
        unsigned long e = libssh2_sftp_last_error(sftp);
        send_error(fd, rid, sftp_strerror(e), (int32_t)e);
        return;
    }
    resolved[rc] = '\0';

    LIBSSH2_SFTP_ATTRIBUTES attrs;
    bool is_dir = false;
    if (libssh2_sftp_stat(sftp, resolved, &attrs) == 0)
        is_dir = (attrs.permissions & LIBSSH2_SFTP_S_IFMT) == LIBSSH2_SFTP_S_IFDIR;

    flatcc_builder_t b;
    flatcc_builder_init(&b);

    Nexterm_SftpProtocol_SftpMessage_start_as_root(&b);
    Nexterm_SftpProtocol_SftpMessage_msg_type_add(&b, Nexterm_SftpProtocol_SftpMsgType_RealpathResult);
    Nexterm_SftpProtocol_SftpMessage_request_id_add(&b, rid);
    Nexterm_SftpProtocol_SftpMessage_realpath_res_start(&b);
    Nexterm_SftpProtocol_RealpathRes_path_create_str(&b, resolved);
    Nexterm_SftpProtocol_RealpathRes_is_dir_add(&b, is_dir);
    Nexterm_SftpProtocol_SftpMessage_realpath_res_end(&b);
    Nexterm_SftpProtocol_SftpMessage_end_as_root(&b);

    sftp_finalize_and_send(&b, fd);
}

static void handle_read_file(LIBSSH2_SFTP* sftp, int fd, uint32_t rid,
                             const char* path) {
    LIBSSH2_SFTP_ATTRIBUTES attrs;
    if (libssh2_sftp_stat(sftp, path, &attrs) != 0) {
        unsigned long e = libssh2_sftp_last_error(sftp);
        send_error(fd, rid, sftp_strerror(e), (int32_t)e);
        return;
    }
    uint64_t total_size = attrs.filesize;

    LIBSSH2_SFTP_HANDLE* fh = libssh2_sftp_open(sftp, path, LIBSSH2_FXF_READ, 0);
    if (!fh) {
        unsigned long e = libssh2_sftp_last_error(sftp);
        send_error(fd, rid, sftp_strerror(e), (int32_t)e);
        return;
    }

    uint8_t chunk[SFTP_CHUNK_SIZE];
    for (;;) {
        ssize_t n = libssh2_sftp_read(fh, (char*)chunk, sizeof(chunk));
        if (n < 0) {
            unsigned long e = libssh2_sftp_last_error(sftp);
            send_error(fd, rid, sftp_strerror(e), (int32_t)e);
            libssh2_sftp_close(fh);
            return;
        }
        if (n == 0) break;
        if (send_file_data(fd, rid, chunk, (size_t)n, total_size) != 0) {
            LOG_WARN("SFTP: failed to send file data chunk");
            libssh2_sftp_close(fh);
            return;
        }
    }

    libssh2_sftp_close(fh);
    send_file_end(fd, rid);
}

static void handle_exec(LIBSSH2_SESSION* ssh, int fd, uint32_t rid,
                        const char* command) {
    char* out = malloc(SFTP_EXEC_BUF);
    char* err_buf = malloc(SFTP_EXEC_BUF);
    if (!out || !err_buf) {
        free(out);
        free(err_buf);
        send_error(fd, rid, "Out of memory", -1);
        return;
    }

    int exit_code = -1;
    if (exec_command(ssh, command, out, SFTP_EXEC_BUF,
                     err_buf, SFTP_EXEC_BUF, &exit_code) != 0) {
        free(out);
        free(err_buf);
        send_error(fd, rid, "Failed to execute command", -1);
        return;
    }

    flatcc_builder_t b;
    flatcc_builder_init(&b);

    Nexterm_SftpProtocol_SftpMessage_start_as_root(&b);
    Nexterm_SftpProtocol_SftpMessage_msg_type_add(&b, Nexterm_SftpProtocol_SftpMsgType_ExecResult);
    Nexterm_SftpProtocol_SftpMessage_request_id_add(&b, rid);
    Nexterm_SftpProtocol_SftpMessage_exec_res_start(&b);
    Nexterm_SftpProtocol_ExecRes_stdout_data_create_str(&b, out);
    Nexterm_SftpProtocol_ExecRes_stderr_data_create_str(&b, err_buf);
    Nexterm_SftpProtocol_ExecRes_exit_code_add(&b, exit_code);
    Nexterm_SftpProtocol_SftpMessage_exec_res_end(&b);
    Nexterm_SftpProtocol_SftpMessage_end_as_root(&b);

    sftp_finalize_and_send(&b, fd);
    free(out);
    free(err_buf);
}

static void parse_search_path(const char* search_path,
                               char* base_path, size_t base_sz,
                               char* search_term, size_t term_sz,
                               bool* inside) {
    size_t sp_len = strlen(search_path);
    *inside = (sp_len > 0 && search_path[sp_len - 1] == '/');

    if (*inside) {
        if (sp_len == 1) {
            snprintf(base_path, base_sz, "/");
        } else {
            snprintf(base_path, base_sz, "%s", search_path);
            base_path[sp_len - 1] = '\0';
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

static void handle_search_dirs(LIBSSH2_SFTP* sftp, int fd, uint32_t rid,
                               const char* search_path, uint32_t max_results) {
    if (max_results == 0 || max_results > SFTP_SEARCH_MAX)
        max_results = SFTP_SEARCH_MAX;

    char base_path[SFTP_MAX_PATH];
    char search_term[256];
    bool inside;
    parse_search_path(search_path, base_path, sizeof(base_path),
                      search_term, sizeof(search_term), &inside);

    search_ctx_t ctx;
    memset(&ctx, 0, sizeof(ctx));
    ctx.max_results = (int)max_results;

    const char* bp = base_path[0] ? base_path : "/";
    search_recursive(sftp, bp, search_term, inside, bp, &ctx, 0);

    flatcc_builder_t b;
    flatcc_builder_init(&b);

    Nexterm_SftpProtocol_SftpMessage_start_as_root(&b);
    Nexterm_SftpProtocol_SftpMessage_msg_type_add(&b, Nexterm_SftpProtocol_SftpMsgType_SearchResult);
    Nexterm_SftpProtocol_SftpMessage_request_id_add(&b, rid);
    Nexterm_SftpProtocol_SftpMessage_search_res_start(&b);
    Nexterm_SftpProtocol_SearchRes_directories_start(&b);
    for (int i = 0; i < ctx.count; i++)
        Nexterm_SftpProtocol_SearchRes_directories_push_create_str(&b, ctx.paths[i]);
    Nexterm_SftpProtocol_SearchRes_directories_end(&b);
    Nexterm_SftpProtocol_SftpMessage_search_res_end(&b);
    Nexterm_SftpProtocol_SftpMessage_end_as_root(&b);

    sftp_finalize_and_send(&b, fd);
}

typedef struct {
    LIBSSH2_SFTP_HANDLE* handle;
    uint32_t rid;
} sftp_write_state_t;

static int sftp_handle_write_data(LIBSSH2_SFTP* sftp, int data_fd,
                                   sftp_write_state_t* ws,
                                   Nexterm_SftpProtocol_SftpMessage_table_t msg) {
    if (!ws->handle) {
        send_error(data_fd, Nexterm_SftpProtocol_SftpMessage_request_id(msg),
                   "No write in progress", -1);
        return 0;
    }

    Nexterm_SftpProtocol_WriteDataReq_table_t req =
        Nexterm_SftpProtocol_SftpMessage_write_data_req(msg);
    if (!req) return 0;

    flatbuffers_uint8_vec_t data = Nexterm_SftpProtocol_WriteDataReq_data(req);
    size_t dlen = flatbuffers_uint8_vec_len(data);
    if (dlen == 0) return 0;

    size_t written = 0;
    while (written < dlen) {
        ssize_t n = libssh2_sftp_write(ws->handle,
            (const char*)data + written, dlen - written);
        if (n < 0) {
            unsigned long e = libssh2_sftp_last_error(sftp);
            send_error(data_fd, ws->rid, sftp_strerror(e), (int32_t)e);
            libssh2_sftp_close(ws->handle);
            ws->handle = NULL;
            return 0;
        }
        written += (size_t)n;
    }
    return 0;
}

static const char* extract_path_req(Nexterm_SftpProtocol_SftpMessage_table_t msg) {
    Nexterm_SftpProtocol_PathReq_table_t req = Nexterm_SftpProtocol_SftpMessage_path_req(msg);
    return req ? Nexterm_SftpProtocol_PathReq_path(req) : NULL;
}

static void dispatch_path_op(Nexterm_SftpProtocol_SftpMsgType_enum_t mt,
                              LIBSSH2_SFTP* sftp, LIBSSH2_SESSION* ssh,
                              int data_fd, uint32_t rid,
                              Nexterm_SftpProtocol_SftpMessage_table_t msg) {
    const char* path = extract_path_req(msg);
    if (!path) { send_error(data_fd, rid, "Missing path", -1); return; }

    switch (mt) {
        case Nexterm_SftpProtocol_SftpMsgType_ListDir:
            handle_list_dir(sftp, data_fd, rid, path); return;
        case Nexterm_SftpProtocol_SftpMsgType_Stat:
            handle_stat(sftp, ssh, data_fd, rid, path); return;
        case Nexterm_SftpProtocol_SftpMsgType_Mkdir:
            handle_mkdir(sftp, data_fd, rid, path); return;
        case Nexterm_SftpProtocol_SftpMsgType_Unlink:
            handle_unlink(sftp, data_fd, rid, path); return;
        case Nexterm_SftpProtocol_SftpMsgType_Realpath:
            handle_realpath(sftp, data_fd, rid, path); return;
        case Nexterm_SftpProtocol_SftpMsgType_ReadFile:
            handle_read_file(sftp, data_fd, rid, path); return;
        default: return;
    }
}

static void dispatch_write_op(Nexterm_SftpProtocol_SftpMsgType_enum_t mt,
                               LIBSSH2_SFTP* sftp, int data_fd, uint32_t rid,
                               Nexterm_SftpProtocol_SftpMessage_table_t msg,
                               sftp_write_state_t* ws) {
    if (mt == Nexterm_SftpProtocol_SftpMsgType_WriteData) {
        sftp_handle_write_data(sftp, data_fd, ws, msg);
        return;
    }

    if (mt == Nexterm_SftpProtocol_SftpMsgType_WriteEnd) {
        if (ws->handle) {
            libssh2_sftp_close(ws->handle);
            ws->handle = NULL;
            send_ok(data_fd, ws->rid);
        }
        return;
    }

    if (ws->handle) {
        libssh2_sftp_close(ws->handle);
        ws->handle = NULL;
    }
    Nexterm_SftpProtocol_WriteBeginReq_table_t req =
        Nexterm_SftpProtocol_SftpMessage_write_begin_req(msg);
    const char* path = req ? Nexterm_SftpProtocol_WriteBeginReq_path(req) : NULL;
    if (!path) { send_error(data_fd, rid, "Missing path", -1); return; }

    ws->handle = libssh2_sftp_open(sftp, path,
        LIBSSH2_FXF_WRITE | LIBSSH2_FXF_CREAT | LIBSSH2_FXF_TRUNC,
        LIBSSH2_SFTP_S_IRUSR | LIBSSH2_SFTP_S_IWUSR |
        LIBSSH2_SFTP_S_IRGRP | LIBSSH2_SFTP_S_IROTH);
    if (!ws->handle) {
        unsigned long e = libssh2_sftp_last_error(sftp);
        send_error(data_fd, rid, sftp_strerror(e), (int32_t)e);
    } else {
        ws->rid = rid;
        send_ok(data_fd, rid);
    }
}

static void dispatch_rmdir(LIBSSH2_SFTP* sftp, int data_fd, uint32_t rid,
                           Nexterm_SftpProtocol_SftpMessage_table_t msg) {
    Nexterm_SftpProtocol_RmdirReq_table_t req = Nexterm_SftpProtocol_SftpMessage_rmdir_req(msg);
    const char* path = req ? Nexterm_SftpProtocol_RmdirReq_path(req) : NULL;
    bool rec = req ? Nexterm_SftpProtocol_RmdirReq_recursive(req) : false;
    if (!path) { send_error(data_fd, rid, "Missing path", -1); return; }
    handle_rmdir(sftp, data_fd, rid, path, rec);
}

static void dispatch_rename(LIBSSH2_SFTP* sftp, int data_fd, uint32_t rid,
                             Nexterm_SftpProtocol_SftpMessage_table_t msg) {
    Nexterm_SftpProtocol_RenameReq_table_t req = Nexterm_SftpProtocol_SftpMessage_rename_req(msg);
    const char* old = req ? Nexterm_SftpProtocol_RenameReq_old_path(req) : NULL;
    const char* new_p = req ? Nexterm_SftpProtocol_RenameReq_new_path(req) : NULL;
    if (!old || !new_p) { send_error(data_fd, rid, "Missing paths", -1); return; }
    handle_rename(sftp, data_fd, rid, old, new_p);
}

static void dispatch_chmod(LIBSSH2_SFTP* sftp, int data_fd, uint32_t rid,
                            Nexterm_SftpProtocol_SftpMessage_table_t msg) {
    Nexterm_SftpProtocol_ChmodReq_table_t req = Nexterm_SftpProtocol_SftpMessage_chmod_req(msg);
    const char* path = req ? Nexterm_SftpProtocol_ChmodReq_path(req) : NULL;
    uint32_t mode = req ? Nexterm_SftpProtocol_ChmodReq_mode(req) : 0;
    if (!path) { send_error(data_fd, rid, "Missing path", -1); return; }
    handle_chmod(sftp, data_fd, rid, path, mode);
}

static void dispatch_exec(LIBSSH2_SESSION* ssh, int data_fd, uint32_t rid,
                           Nexterm_SftpProtocol_SftpMessage_table_t msg) {
    Nexterm_SftpProtocol_ExecReq_table_t req = Nexterm_SftpProtocol_SftpMessage_exec_req(msg);
    const char* command = req ? Nexterm_SftpProtocol_ExecReq_command(req) : NULL;
    if (!command) { send_error(data_fd, rid, "Missing command", -1); return; }
    handle_exec(ssh, data_fd, rid, command);
}

static void dispatch_search(LIBSSH2_SFTP* sftp, int data_fd, uint32_t rid,
                             Nexterm_SftpProtocol_SftpMessage_table_t msg) {
    Nexterm_SftpProtocol_SearchReq_table_t req = Nexterm_SftpProtocol_SftpMessage_search_req(msg);
    const char* sp = req ? Nexterm_SftpProtocol_SearchReq_search_path(req) : NULL;
    uint32_t max = req ? Nexterm_SftpProtocol_SearchReq_max_results(req) : SFTP_SEARCH_MAX;
    if (!sp) { send_error(data_fd, rid, "Missing search path", -1); return; }
    handle_search_dirs(sftp, data_fd, rid, sp, max);
}

static int sftp_dispatch_message(LIBSSH2_SFTP* sftp, LIBSSH2_SESSION* ssh,
                                  int data_fd,
                                  Nexterm_SftpProtocol_SftpMessage_table_t msg,
                                  sftp_write_state_t* ws) {
    Nexterm_SftpProtocol_SftpMsgType_enum_t mt =
        Nexterm_SftpProtocol_SftpMessage_msg_type(msg);
    uint32_t rid = Nexterm_SftpProtocol_SftpMessage_request_id(msg);

    switch (mt) {
        case Nexterm_SftpProtocol_SftpMsgType_ListDir:
        case Nexterm_SftpProtocol_SftpMsgType_Stat:
        case Nexterm_SftpProtocol_SftpMsgType_Mkdir:
        case Nexterm_SftpProtocol_SftpMsgType_Unlink:
        case Nexterm_SftpProtocol_SftpMsgType_Realpath:
        case Nexterm_SftpProtocol_SftpMsgType_ReadFile:
            dispatch_path_op(mt, sftp, ssh, data_fd, rid, msg);
            return 0;

        case Nexterm_SftpProtocol_SftpMsgType_WriteBegin:
        case Nexterm_SftpProtocol_SftpMsgType_WriteData:
        case Nexterm_SftpProtocol_SftpMsgType_WriteEnd:
            dispatch_write_op(mt, sftp, data_fd, rid, msg, ws);
            return 0;

        case Nexterm_SftpProtocol_SftpMsgType_Rmdir:
            dispatch_rmdir(sftp, data_fd, rid, msg); return 0;
        case Nexterm_SftpProtocol_SftpMsgType_Rename:
            dispatch_rename(sftp, data_fd, rid, msg); return 0;
        case Nexterm_SftpProtocol_SftpMsgType_Chmod:
            dispatch_chmod(sftp, data_fd, rid, msg); return 0;
        case Nexterm_SftpProtocol_SftpMsgType_Exec:
            dispatch_exec(ssh, data_fd, rid, msg); return 0;
        case Nexterm_SftpProtocol_SftpMsgType_SearchDirs:
            dispatch_search(sftp, data_fd, rid, msg); return 0;

        default:
            LOG_WARN("SFTP: unknown msg_type %d", mt);
            send_error(data_fd, rid, "Unknown operation", -1);
            return 0;
    }
}

static void sftp_request_loop(nexterm_session_t* session,
                               LIBSSH2_SFTP* sftp, LIBSSH2_SESSION* ssh,
                               int data_fd) {
    sftp_write_state_t ws = { .handle = NULL, .rid = 0 };

    while (session->state == SESSION_STATE_ACTIVE) {
        uint32_t payload_len;
        uint8_t* payload = nexterm_read_frame(data_fd, SFTP_MAX_FRAME, &payload_len);
        if (!payload) {
            LOG_DEBUG("SFTP session %s: connection closed or read error",
                      session->session_id);
            break;
        }

        Nexterm_SftpProtocol_SftpMessage_table_t msg =
            Nexterm_SftpProtocol_SftpMessage_as_root(payload);
        if (!msg) {
            LOG_WARN("SFTP session %s: invalid FlatBuffers message", session->session_id);
            free(payload);
            continue;
        }

        sftp_dispatch_message(sftp, ssh, data_fd, msg, &ws);
        free(payload);
    }

    if (ws.handle)
        libssh2_sftp_close(ws.handle);
}

static void* sftp_session_thread(void* arg) {
    sftp_thread_args_t* args = (sftp_thread_args_t*)arg;
    nexterm_session_t* session = args->session;
    nexterm_control_plane_t* cp = args->cp;
    int data_fd = -1;
    int ssh_sock = -1;
    LIBSSH2_SESSION* ssh = NULL;
    LIBSSH2_SFTP* sftp = NULL;

    session->state = SESSION_STATE_CONNECTING;

    const char* username   = nexterm_session_get_param(session, "username");
    const char* password   = nexterm_session_get_param(session, "password");
    const char* priv_key   = nexterm_session_get_param(session, "privateKey");
    const char* passphrase = nexterm_session_get_param(session, "passphrase");

    if (!username || strlen(username) == 0) {
        LOG_ERROR("SFTP session %s: missing username", session->session_id);
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Missing username", NULL);
        session->state = SESSION_STATE_CLOSED;
        free(args);
        return NULL;
    }

    LOG_INFO("SFTP session %s: connecting to %s:%u as %s",
             session->session_id, session->host, session->port, username);

    data_fd = nexterm_cp_open_data_connection(cp, session->session_id);
    if (data_fd < 0) {
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Failed to open data connection", NULL);
        session->state = SESSION_STATE_CLOSED;
        free(args);
        return NULL;
    }

    if (nexterm_ssh_setup(session->host, session->port, &ssh_sock, &ssh) != 0) {
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Failed to connect to SSH host", NULL);
        goto cleanup;
    }

    if (nexterm_ssh_auth(ssh, username, password, priv_key, passphrase) != 0) {
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "SSH authentication failed", NULL);
        goto cleanup;
    }

    LOG_DEBUG("SFTP session %s: authenticated", session->session_id);

    sftp = libssh2_sftp_init(ssh);
    if (!sftp) {
        char* errmsg = NULL;
        libssh2_session_last_error(ssh, &errmsg, NULL, 0);
        LOG_ERROR("SFTP session %s: failed to open SFTP: %s",
                  session->session_id, errmsg ? errmsg : "unknown");
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Failed to open SFTP subsystem", NULL);
        goto cleanup;
    }

    session->state = SESSION_STATE_ACTIVE;
    nexterm_cp_send_session_result(cp, session->session_id, true, NULL, NULL);

    if (send_ready(data_fd) != 0) {
        LOG_ERROR("SFTP session %s: failed to send Ready", session->session_id);
        goto cleanup;
    }

    LOG_INFO("SFTP session %s active (target=%s:%u, user=%s)",
             session->session_id, session->host, session->port, username);

    sftp_request_loop(session, sftp, ssh, data_fd);

    LOG_INFO("SFTP session %s ending", session->session_id);

cleanup:
    if (sftp) libssh2_sftp_shutdown(sftp);
    nexterm_ssh_teardown(ssh, NULL, ssh_sock, "Session ended");
    if (data_fd >= 0)
        close(data_fd);

    session->state = SESSION_STATE_CLOSED;
    nexterm_cp_send_session_closed(cp, session->session_id, "session ended");

    free(args);
    return NULL;
}

int nexterm_sftp_start(nexterm_session_t* session,
                       nexterm_control_plane_t* cp) {
    sftp_thread_args_t* args = calloc(1, sizeof(sftp_thread_args_t));
    if (!args) return -1;

    args->session = session;
    args->cp = cp;

    if (pthread_create(&session->thread, NULL, sftp_session_thread, args) != 0) {
        LOG_ERROR("Failed to create SFTP thread for session %s",
                  session->session_id);
        free(args);
        return -1;
    }

    session->thread_active = true;
    pthread_detach(session->thread);
    return 0;
}
