#include "sftp.h"
#include "ssh.h"
#include "ssh_common.h"
#include "control_plane.h"
#include "file_proto.h"
#include "io.h"
#include "log.h"
#include "thumbnail.h"

extern nexterm_session_manager_t g_session_manager;

#include <libssh2.h>
#include <libssh2_sftp.h>

#include "sftp_protocol_reader.h"

#include <errno.h>
#include <poll.h>
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#define SFTP_WRITE_BUF     1048576
#define SFTP_EXEC_BUF      (256 * 1024)

typedef struct {
    nexterm_session_t* session;
    nexterm_control_plane_t* cp;
} sftp_thread_args_t;

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

static void send_sftp_error(LIBSSH2_SFTP* sftp, int fd, uint32_t rid) {
    unsigned long e = libssh2_sftp_last_error(sftp);
    fp_send_error(fd, rid, sftp_strerror(e), (int32_t)e);
}

static void append_capped(char* dst, size_t cap, size_t* len,
                          const char* src, size_t n) {
    if (*len + 1 >= cap) return;
    size_t remaining = cap - 1 - *len;
    size_t copy = (n <= remaining) ? n : remaining;
    memcpy(dst + *len, src, copy);
    *len += copy;
}

static int exec_command(LIBSSH2_SESSION* ssh, const char* cmd,
                        char* out, size_t out_sz,
                        char* err_buf, size_t err_sz,
                        int* exit_code, uint32_t timeout_ms,
                        bool* timed_out) {
    LIBSSH2_CHANNEL* ch = libssh2_channel_open_session(ssh);
    if (!ch) return -1;

    if (libssh2_channel_exec(ch, cmd) != 0) {
        libssh2_channel_free(ch);
        return -1;
    }

    const int64_t deadline = fp_monotonic_ms() + (int64_t)timeout_ms;
    size_t out_len = 0, err_len = 0;
    char tmp[4096];
    *timed_out = false;

    libssh2_session_set_blocking(ssh, 0);

    for (;;) {
        bool got_data = false;
        bool failed = false;

        for (int stream = 0; stream <= 1 && !failed; stream++) {
            for (;;) {
                ssize_t n = stream
                    ? libssh2_channel_read_stderr(ch, tmp, sizeof(tmp))
                    : libssh2_channel_read(ch, tmp, sizeof(tmp));
                if (n > 0) {
                    got_data = true;
                    if (stream)
                        append_capped(err_buf, err_sz, &err_len, tmp, (size_t)n);
                    else
                        append_capped(out, out_sz, &out_len, tmp, (size_t)n);
                    continue;
                }
                if (n < 0 && n != LIBSSH2_ERROR_EAGAIN && n != LIBSSH2_ERROR_TIMEOUT)
                    failed = true;
                break;
            }
        }

        if (failed) break;
        if (libssh2_channel_eof(ch)) break;
        if (fp_monotonic_ms() >= deadline) {
            *timed_out = true;
            break;
        }
        if (!got_data) usleep(100 * 1000);
    }

    out[out_len] = '\0';
    err_buf[err_len] = '\0';

    libssh2_session_set_blocking(ssh, 1);
    libssh2_channel_close(ch);
    if (!*timed_out) libssh2_channel_wait_closed(ch);
    *exit_code = *timed_out ? 124 : libssh2_channel_get_exit_status(ch);
    libssh2_channel_free(ch);
    return 0;
}

#define SFTP_RMDIR_MAX_DEPTH 64

static int recursive_rmdir_depth(LIBSSH2_SFTP* sftp, const char* path, int depth) {
    if (depth > SFTP_RMDIR_MAX_DEPTH) {
        LOG_WARN("SFTP: recursive delete exceeded max depth at %s", path);
        return -1;
    }

    LIBSSH2_SFTP_HANDLE* dir = libssh2_sftp_opendir(sftp, path);
    if (!dir) return -1;

    char name[512];
    char longentry[512];
    LIBSSH2_SFTP_ATTRIBUTES attrs;
    char fullpath[FP_MAX_PATH];

    while (libssh2_sftp_readdir_ex(dir, name, sizeof(name),
                                    longentry, sizeof(longentry), &attrs) > 0) {
        if (strcmp(name, ".") == 0 || strcmp(name, "..") == 0) continue;

        fp_join_path(path, name, fullpath, sizeof(fullpath));

        if (longentry[0] == 'd')
            recursive_rmdir_depth(sftp, fullpath, depth + 1);
        else
            libssh2_sftp_unlink(sftp, fullpath);
    }

    libssh2_sftp_closedir(dir);
    return libssh2_sftp_rmdir(sftp, path);
}

static int recursive_rmdir(LIBSSH2_SFTP* sftp, const char* path) {
    return recursive_rmdir_depth(sftp, path, 0);
}

static void search_list_level(LIBSSH2_SFTP* sftp, const char* base,
                              const char* search_term, bool inside,
                              fp_search_t* ctx) {
    LIBSSH2_SFTP_HANDLE* dir = libssh2_sftp_opendir(sftp, base);
    if (!dir) return;

    char name[512];
    char longentry[512];
    LIBSSH2_SFTP_ATTRIBUTES attrs;

    while (ctx->count < ctx->max_results) {
        if (fp_monotonic_ms() >= ctx->deadline) {
            ctx->timed_out = true;
            break;
        }
        if (libssh2_sftp_readdir_ex(dir, name, sizeof(name),
                                    longentry, sizeof(longentry), &attrs) <= 0)
            break;
        if (strcmp(name, ".") == 0 || strcmp(name, "..") == 0) continue;
        if (longentry[0] != 'd') continue;
        if (!inside && !fp_name_matches(name, search_term)) continue;

        fp_join_path(base, name, ctx->paths[ctx->count], FP_MAX_PATH);
        ctx->count++;
    }

    libssh2_sftp_closedir(dir);
}

static void handle_list_dir(LIBSSH2_SFTP* sftp, int fd, uint32_t rid,
                            const char* path) {
    LIBSSH2_SFTP_HANDLE* dir = libssh2_sftp_opendir(sftp, path);
    if (!dir) {
        send_sftp_error(sftp, fd, rid);
        return;
    }

    fp_entries_t entries = {0};
    char name[512];
    char longentry[512];
    LIBSSH2_SFTP_ATTRIBUTES attrs;

    while (libssh2_sftp_readdir_ex(dir, name, sizeof(name),
                                    longentry, sizeof(longentry), &attrs) > 0) {
        if (strcmp(name, ".") == 0 || strcmp(name, "..") == 0) continue;

        fp_entries_push(&entries, name, longentry[0] == 'd', longentry[0] == 'l',
                        attrs.filesize, (uint32_t)attrs.mtime,
                        (uint32_t)attrs.permissions);
    }

    libssh2_sftp_closedir(dir);

    fp_send_dir_list(fd, rid, &entries);
    fp_entries_free(&entries);
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

    char escaped[FP_MAX_PATH * 2];
    shell_escape_path(path, escaped, sizeof(escaped));

    char cmd[FP_MAX_PATH * 2 + 64];
    snprintf(cmd, sizeof(cmd), "stat -c '%%U:%%G' %s 2>/dev/null || echo ':'", escaped);

    char out[256];
    char err[256];
    int ec;
    bool timed_out = false;
    if (exec_command(ssh, cmd, out, sizeof(out), err, sizeof(err), &ec, 30000, &timed_out) != 0)
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
        send_sftp_error(sftp, fd, rid);
        return;
    }

    fp_stat_t st;
    memset(&st, 0, sizeof(st));
    st.size = attrs.filesize;
    st.mode = (uint32_t)attrs.permissions;
    st.uid = (uint32_t)attrs.uid;
    st.gid = (uint32_t)attrs.gid;
    st.atime = (uint32_t)attrs.atime;
    st.mtime = (uint32_t)attrs.mtime;
    st.is_dir = (attrs.permissions & LIBSSH2_SFTP_S_IFMT) == LIBSSH2_SFTP_S_IFDIR;
    stat_get_owner_group(ssh, path, st.owner, sizeof(st.owner),
                         st.group, sizeof(st.group));

    fp_send_stat(fd, rid, &st);
}

static void handle_mkdir(LIBSSH2_SFTP* sftp, int fd, uint32_t rid,
                         const char* path) {
    if (libssh2_sftp_mkdir(sftp, path, 0755) != 0)
        send_sftp_error(sftp, fd, rid);
    else
        fp_send_ok(fd, rid);
}

static void handle_rmdir(LIBSSH2_SFTP* sftp, int fd, uint32_t rid,
                         const char* path, bool recursive) {
    int rc = recursive ? recursive_rmdir(sftp, path) : libssh2_sftp_rmdir(sftp, path);
    if (rc != 0)
        send_sftp_error(sftp, fd, rid);
    else
        fp_send_ok(fd, rid);
}

static void handle_unlink(LIBSSH2_SFTP* sftp, int fd, uint32_t rid,
                          const char* path) {
    if (libssh2_sftp_unlink(sftp, path) != 0)
        send_sftp_error(sftp, fd, rid);
    else
        fp_send_ok(fd, rid);
}

static void handle_rename(LIBSSH2_SFTP* sftp, int fd, uint32_t rid,
                          const char* old_path, const char* new_path) {
    int rc = libssh2_sftp_rename_ex(sftp,
        old_path, (unsigned int)strlen(old_path),
        new_path, (unsigned int)strlen(new_path),
        LIBSSH2_SFTP_RENAME_OVERWRITE | LIBSSH2_SFTP_RENAME_ATOMIC |
        LIBSSH2_SFTP_RENAME_NATIVE);
    if (rc != 0)
        send_sftp_error(sftp, fd, rid);
    else
        fp_send_ok(fd, rid);
}

static void handle_chmod(LIBSSH2_SFTP* sftp, int fd, uint32_t rid,
                         const char* path, uint32_t mode) {
    LIBSSH2_SFTP_ATTRIBUTES attrs;
    memset(&attrs, 0, sizeof(attrs));
    attrs.flags = LIBSSH2_SFTP_ATTR_PERMISSIONS;
    attrs.permissions = (unsigned long)mode;

    int rc = libssh2_sftp_stat_ex(sftp, path, (unsigned int)strlen(path),
                                   LIBSSH2_SFTP_SETSTAT, &attrs);
    if (rc != 0)
        send_sftp_error(sftp, fd, rid);
    else
        fp_send_ok(fd, rid);
}

static void handle_realpath(LIBSSH2_SFTP* sftp, int fd, uint32_t rid,
                            const char* path) {
    char resolved[FP_MAX_PATH];
    int rc = libssh2_sftp_realpath(sftp, path, resolved, sizeof(resolved) - 1);
    if (rc < 0) {
        send_sftp_error(sftp, fd, rid);
        return;
    }
    resolved[rc] = '\0';

    LIBSSH2_SFTP_ATTRIBUTES attrs;
    bool is_dir = false;
    if (libssh2_sftp_stat(sftp, resolved, &attrs) == 0)
        is_dir = (attrs.permissions & LIBSSH2_SFTP_S_IFMT) == LIBSSH2_SFTP_S_IFDIR;

    fp_send_realpath(fd, rid, resolved, is_dir);
}

static void handle_read_file(LIBSSH2_SFTP* sftp, int fd, uint32_t rid,
                             const char* path) {
    LIBSSH2_SFTP_ATTRIBUTES attrs;
    if (libssh2_sftp_stat(sftp, path, &attrs) != 0) {
        send_sftp_error(sftp, fd, rid);
        return;
    }
    uint64_t total_size = attrs.filesize;

    LIBSSH2_SFTP_HANDLE* fh = libssh2_sftp_open(sftp, path, LIBSSH2_FXF_READ, 0);
    if (!fh) {
        send_sftp_error(sftp, fd, rid);
        return;
    }

    uint8_t* chunk = malloc(FP_CHUNK_SIZE);
    if (!chunk) {
        fp_send_error(fd, rid, "Out of memory", -1);
        libssh2_sftp_close(fh);
        return;
    }
    for (;;) {
        ssize_t n = libssh2_sftp_read(fh, (char*)chunk, FP_CHUNK_SIZE);
        if (n < 0) {
            send_sftp_error(sftp, fd, rid);
            free(chunk);
            libssh2_sftp_close(fh);
            return;
        }
        if (n == 0) break;
        if (fp_send_file_data(fd, rid, chunk, (size_t)n, total_size) != 0) {
            LOG_WARN("SFTP: failed to send file data chunk");
            free(chunk);
            libssh2_sftp_close(fh);
            return;
        }
    }

    free(chunk);
    libssh2_sftp_close(fh);
    fp_send_file_end(fd, rid);
}

static void handle_thumbnail(LIBSSH2_SFTP* sftp, int fd, uint32_t rid,
                             const char* path, uint32_t size) {
    LIBSSH2_SFTP_ATTRIBUTES attrs;
    if (libssh2_sftp_stat(sftp, path, &attrs) != 0) {
        send_sftp_error(sftp, fd, rid);
        return;
    }
    if (attrs.filesize == 0 || attrs.filesize > FP_THUMB_MAX_BYTES) {
        fp_send_error(fd, rid, "Image too large for thumbnail", -1);
        return;
    }

    size_t flen = (size_t)attrs.filesize;
    uint8_t* filebuf = malloc(flen);
    if (!filebuf) { fp_send_error(fd, rid, "Out of memory", -1); return; }

    LIBSSH2_SFTP_HANDLE* fh = libssh2_sftp_open(sftp, path, LIBSSH2_FXF_READ, 0);
    if (!fh) {
        send_sftp_error(sftp, fd, rid);
        free(filebuf);
        return;
    }

    size_t got = 0;
    while (got < flen) {
        ssize_t n = libssh2_sftp_read(fh, (char*)filebuf + got, flen - got);
        if (n < 0) {
            send_sftp_error(sftp, fd, rid);
            libssh2_sftp_close(fh);
            free(filebuf);
            return;
        }
        if (n == 0) break;
        got += (size_t)n;
    }
    libssh2_sftp_close(fh);

    uint8_t* jpeg = NULL;
    size_t jpeg_len = 0;
    int ow = 0, oh = 0;
    if (nexterm_make_thumbnail(filebuf, got, (int)size, &jpeg, &jpeg_len, &ow, &oh) != 0) {
        free(filebuf);
        fp_send_error(fd, rid, "Failed to generate thumbnail", -1);
        return;
    }
    free(filebuf);

    fp_send_thumbnail(fd, rid, jpeg, jpeg_len, (uint32_t)ow, (uint32_t)oh);
    free(jpeg);
}

static void handle_exec(LIBSSH2_SESSION* ssh, int fd, uint32_t rid,
                        const char* command, uint32_t timeout_ms) {
    char* out = malloc(SFTP_EXEC_BUF);
    char* err_buf = malloc(SFTP_EXEC_BUF);
    if (!out || !err_buf) {
        free(out);
        free(err_buf);
        fp_send_error(fd, rid, "Out of memory", -1);
        return;
    }

    int exit_code = -1;
    bool timed_out = false;
    if (exec_command(ssh, command, out, SFTP_EXEC_BUF,
                     err_buf, SFTP_EXEC_BUF, &exit_code, timeout_ms, &timed_out) != 0) {
        free(out);
        free(err_buf);
        fp_send_error(fd, rid, "Failed to execute command", -1);
        return;
    }

    if (timed_out) {
        LOG_WARN("SFTP: exec timed out after %u ms", timeout_ms);
        size_t el = strlen(err_buf);
        snprintf(err_buf + el, SFTP_EXEC_BUF - el,
                 "%s[command timed out after %u seconds]",
                 el ? "\n" : "", timeout_ms / 1000);
    }

    fp_send_exec_result(fd, rid, out, err_buf, exit_code);
    free(out);
    free(err_buf);
}

static void handle_search_dirs(LIBSSH2_SFTP* sftp, int fd, uint32_t rid,
                               const char* search_path, uint32_t max_results,
                               uint32_t timeout_ms) {
    if (max_results == 0 || max_results > FP_SEARCH_MAX)
        max_results = FP_SEARCH_MAX;

    char base_path[FP_MAX_PATH];
    char search_term[256];
    bool inside;
    fp_parse_search_path(search_path, base_path, sizeof(base_path),
                         search_term, sizeof(search_term), &inside);

    fp_search_t ctx;
    memset(&ctx, 0, sizeof(ctx));
    ctx.max_results = (int)max_results;
    ctx.deadline = fp_monotonic_ms() + (int64_t)timeout_ms;

    const char* bp = base_path[0] ? base_path : "/";
    search_list_level(sftp, bp, search_term, inside, &ctx);

    if (ctx.timed_out)
        LOG_WARN("SFTP: search timed out after %u ms, returning %d partial result(s)",
                 timeout_ms, ctx.count);

    fp_send_search_result(fd, rid, &ctx);
}

typedef struct {
    LIBSSH2_SFTP_HANDLE* handle;
    uint32_t rid;
    uint8_t* buf;
    size_t buf_len;
    size_t buf_cap;
} sftp_write_state_t;

static int sftp_write_raw(LIBSSH2_SFTP* sftp, int data_fd,
                          sftp_write_state_t* ws,
                          const uint8_t* data, size_t dlen) {
    size_t written = 0;
    while (written < dlen) {
        ssize_t n = libssh2_sftp_write(ws->handle,
            (const char*)data + written, dlen - written);
        if (n < 0) {
            send_sftp_error(sftp, data_fd, ws->rid);
            libssh2_sftp_close(ws->handle);
            ws->handle = NULL;
            return -1;
        }
        written += (size_t)n;
    }
    return 0;
}

static int sftp_flush_write(LIBSSH2_SFTP* sftp, int data_fd,
                            sftp_write_state_t* ws) {
    if (!ws->handle || ws->buf_len == 0) return 0;
    int rc = sftp_write_raw(sftp, data_fd, ws, ws->buf, ws->buf_len);
    ws->buf_len = 0;
    return rc;
}

static int sftp_handle_write_data(LIBSSH2_SFTP* sftp, int data_fd,
                                   sftp_write_state_t* ws,
                                   Nexterm_SftpProtocol_SftpMessage_table_t msg) {
    if (!ws->handle) {
        fp_send_error(data_fd, Nexterm_SftpProtocol_SftpMessage_request_id(msg),
                      "No write in progress", -1);
        return 0;
    }

    Nexterm_SftpProtocol_WriteDataReq_table_t req =
        Nexterm_SftpProtocol_SftpMessage_write_data_req(msg);
    if (!req) return 0;

    flatbuffers_uint8_vec_t data = Nexterm_SftpProtocol_WriteDataReq_data(req);
    size_t dlen = flatbuffers_uint8_vec_len(data);
    if (dlen == 0) return 0;

    if (dlen >= ws->buf_cap) {
        if (sftp_flush_write(sftp, data_fd, ws) != 0) return 0;
        sftp_write_raw(sftp, data_fd, ws, data, dlen);
        return 0;
    }

    if (ws->buf_len + dlen > ws->buf_cap) {
        if (sftp_flush_write(sftp, data_fd, ws) != 0) return 0;
    }

    memcpy(ws->buf + ws->buf_len, data, dlen);
    ws->buf_len += dlen;

    if (ws->buf_len >= SFTP_WRITE_BUF)
        sftp_flush_write(sftp, data_fd, ws);

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
    if (!path) { fp_send_error(data_fd, rid, "Missing path", -1); return; }

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
            if (sftp_flush_write(sftp, data_fd, ws) != 0) return;
            libssh2_sftp_close(ws->handle);
            ws->handle = NULL;
            fp_send_ok(data_fd, ws->rid);
        }
        return;
    }

    if (ws->handle) {
        sftp_flush_write(sftp, data_fd, ws);
        libssh2_sftp_close(ws->handle);
        ws->handle = NULL;
    }
    ws->buf_len = 0;
    if (!ws->buf) {
        ws->buf = malloc(SFTP_WRITE_BUF);
        if (!ws->buf) { fp_send_error(data_fd, rid, "Out of memory", -1); return; }
        ws->buf_cap = SFTP_WRITE_BUF;
    }
    Nexterm_SftpProtocol_WriteBeginReq_table_t req =
        Nexterm_SftpProtocol_SftpMessage_write_begin_req(msg);
    const char* path = req ? Nexterm_SftpProtocol_WriteBeginReq_path(req) : NULL;
    if (!path) { fp_send_error(data_fd, rid, "Missing path", -1); return; }

    ws->handle = libssh2_sftp_open(sftp, path,
        LIBSSH2_FXF_WRITE | LIBSSH2_FXF_CREAT | LIBSSH2_FXF_TRUNC,
        LIBSSH2_SFTP_S_IRUSR | LIBSSH2_SFTP_S_IWUSR |
        LIBSSH2_SFTP_S_IRGRP | LIBSSH2_SFTP_S_IROTH);
    if (!ws->handle) {
        send_sftp_error(sftp, data_fd, rid);
    } else {
        ws->rid = rid;
        fp_send_ok(data_fd, rid);
    }
}

static void dispatch_rmdir(LIBSSH2_SFTP* sftp, int data_fd, uint32_t rid,
                           Nexterm_SftpProtocol_SftpMessage_table_t msg) {
    Nexterm_SftpProtocol_RmdirReq_table_t req = Nexterm_SftpProtocol_SftpMessage_rmdir_req(msg);
    const char* path = req ? Nexterm_SftpProtocol_RmdirReq_path(req) : NULL;
    bool rec = req ? Nexterm_SftpProtocol_RmdirReq_recursive(req) : false;
    if (!path) { fp_send_error(data_fd, rid, "Missing path", -1); return; }
    handle_rmdir(sftp, data_fd, rid, path, rec);
}

static void dispatch_rename(LIBSSH2_SFTP* sftp, int data_fd, uint32_t rid,
                             Nexterm_SftpProtocol_SftpMessage_table_t msg) {
    Nexterm_SftpProtocol_RenameReq_table_t req = Nexterm_SftpProtocol_SftpMessage_rename_req(msg);
    const char* old = req ? Nexterm_SftpProtocol_RenameReq_old_path(req) : NULL;
    const char* new_p = req ? Nexterm_SftpProtocol_RenameReq_new_path(req) : NULL;
    if (!old || !new_p) { fp_send_error(data_fd, rid, "Missing paths", -1); return; }
    handle_rename(sftp, data_fd, rid, old, new_p);
}

static void dispatch_chmod(LIBSSH2_SFTP* sftp, int data_fd, uint32_t rid,
                            Nexterm_SftpProtocol_SftpMessage_table_t msg) {
    Nexterm_SftpProtocol_ChmodReq_table_t req = Nexterm_SftpProtocol_SftpMessage_chmod_req(msg);
    const char* path = req ? Nexterm_SftpProtocol_ChmodReq_path(req) : NULL;
    uint32_t mode = req ? Nexterm_SftpProtocol_ChmodReq_mode(req) : 0;
    if (!path) { fp_send_error(data_fd, rid, "Missing path", -1); return; }
    handle_chmod(sftp, data_fd, rid, path, mode);
}

static void dispatch_exec(LIBSSH2_SESSION* ssh, int data_fd, uint32_t rid,
                           Nexterm_SftpProtocol_SftpMessage_table_t msg) {
    Nexterm_SftpProtocol_ExecReq_table_t req = Nexterm_SftpProtocol_SftpMessage_exec_req(msg);
    const char* command = req ? Nexterm_SftpProtocol_ExecReq_command(req) : NULL;
    uint32_t timeout_ms = req ? Nexterm_SftpProtocol_ExecReq_timeout_ms(req) : 0;
    if (!command) { fp_send_error(data_fd, rid, "Missing command", -1); return; }
    if (timeout_ms == 0) timeout_ms = 300000;
    handle_exec(ssh, data_fd, rid, command, timeout_ms);
}

static void dispatch_search(LIBSSH2_SFTP* sftp, int data_fd, uint32_t rid,
                             Nexterm_SftpProtocol_SftpMessage_table_t msg) {
    Nexterm_SftpProtocol_SearchReq_table_t req = Nexterm_SftpProtocol_SftpMessage_search_req(msg);
    const char* sp = req ? Nexterm_SftpProtocol_SearchReq_search_path(req) : NULL;
    uint32_t max = req ? Nexterm_SftpProtocol_SearchReq_max_results(req) : FP_SEARCH_MAX;
    uint32_t timeout_ms = req ? Nexterm_SftpProtocol_SearchReq_timeout_ms(req) : 0;
    if (!sp) { fp_send_error(data_fd, rid, "Missing search path", -1); return; }
    if (timeout_ms == 0) timeout_ms = 30000;
    handle_search_dirs(sftp, data_fd, rid, sp, max, timeout_ms);
}

static void dispatch_thumbnail(LIBSSH2_SFTP* sftp, int data_fd, uint32_t rid,
                               Nexterm_SftpProtocol_SftpMessage_table_t msg) {
    Nexterm_SftpProtocol_ThumbnailReq_table_t req = Nexterm_SftpProtocol_SftpMessage_thumbnail_req(msg);
    const char* path = req ? Nexterm_SftpProtocol_ThumbnailReq_path(req) : NULL;
    uint32_t size = req ? Nexterm_SftpProtocol_ThumbnailReq_size(req) : 100;
    if (!path) { fp_send_error(data_fd, rid, "Missing path", -1); return; }
    handle_thumbnail(sftp, data_fd, rid, path, size);
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
        case Nexterm_SftpProtocol_SftpMsgType_Thumbnail:
            dispatch_thumbnail(sftp, data_fd, rid, msg); return 0;

        default:
            LOG_WARN("SFTP: unknown msg_type %d", mt);
            fp_send_error(data_fd, rid, "Unknown operation", -1);
            return 0;
    }
}

static void sftp_request_loop(nexterm_session_t* session,
                               LIBSSH2_SFTP* sftp, LIBSSH2_SESSION* ssh,
                               int data_fd) {
    sftp_write_state_t ws = { .handle = NULL, .rid = 0,
                              .buf = NULL, .buf_len = 0, .buf_cap = 0 };

    while (session->state == SESSION_STATE_ACTIVE) {
        struct pollfd pfd = { .fd = data_fd, .events = POLLIN };
        int ret = poll(&pfd, 1, 1000);
        if (ret == 0) continue;
        if (ret < 0) { if (errno == EINTR) continue; break; }
        if (pfd.revents & (POLLERR | POLLHUP | POLLNVAL)) break;

        uint32_t payload_len;
        uint8_t* payload = nexterm_read_frame(data_fd, FP_MAX_FRAME, &payload_len);
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

    if (ws.handle) {
        sftp_flush_write(sftp, data_fd, &ws);
        libssh2_sftp_close(ws.handle);
    }
    free(ws.buf);
}

static void* sftp_session_thread(void* arg) {
    sftp_thread_args_t* args = (sftp_thread_args_t*)arg;
    nexterm_session_t* session = args->session;
    nexterm_control_plane_t* cp = args->cp;
    int data_fd = -1;
    int ssh_sock = -1;
    LIBSSH2_SESSION* ssh = NULL;
    LIBSSH2_SFTP* sftp = NULL;
    jump_chain_t jump_chain = {0};

    session->state = SESSION_STATE_CONNECTING;

    const char* username   = nexterm_session_get_param(session, "username");
    const char* password   = nexterm_session_get_param(session, "password");
    const char* priv_key   = nexterm_session_get_param(session, "privateKey");
    const char* passphrase = nexterm_session_get_param(session, "passphrase");

    if (!username || strlen(username) == 0) {
        LOG_ERROR("SFTP session %s: missing username", session->session_id);
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Missing username", NULL);
        goto cleanup;
    }

    jump_host_t jump_hosts[MAX_JUMP_HOSTS];
    int jump_count = nexterm_extract_jump_hosts(session, jump_hosts, MAX_JUMP_HOSTS);

    LOG_INFO("SFTP session %s: connecting to %s:%u as %s (jump_hosts=%d)",
             session->session_id, session->host, session->port, username, jump_count);

    data_fd = nexterm_cp_open_data_connection(cp, session->session_id);
    if (data_fd < 0) {
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Failed to open data connection", NULL);
        goto cleanup;
    }

    if (nexterm_ssh_setup_with_jumphosts(session->host, session->port,
            jump_hosts, jump_count, &ssh_sock, &ssh, &jump_chain) != 0) {
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

    if (fp_send_ready(data_fd) != 0) {
        LOG_ERROR("SFTP session %s: failed to send Ready", session->session_id);
        goto cleanup;
    }

    LOG_INFO("SFTP session %s active (target=%s:%u, user=%s)",
             session->session_id, session->host, session->port, username);

    sftp_request_loop(session, sftp, ssh, data_fd);

    LOG_INFO("SFTP session %s ending", session->session_id);

cleanup:
    if (sftp) libssh2_sftp_shutdown(sftp);
    nexterm_ssh_full_cleanup(ssh, NULL, ssh_sock, &jump_chain, "Session ended");
    if (data_fd >= 0)
        close(data_fd);

    char sid[MAX_SESSION_ID_LEN];
    snprintf(sid, sizeof(sid), "%s", session->session_id);
    nexterm_cp_send_session_closed(cp, sid, "session ended");
    nexterm_sm_finish(&g_session_manager, sid);

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
