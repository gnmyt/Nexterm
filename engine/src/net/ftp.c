#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif

#include "ftp.h"
#include "control_plane.h"
#include "file_proto.h"
#include "io.h"
#include "log.h"
#include "thumbnail.h"

extern nexterm_session_manager_t g_session_manager;

#include <curl/curl.h>

#include "sftp_protocol_reader.h"

#include <errno.h>
#include <poll.h>
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <sys/stat.h>
#include <time.h>
#include <unistd.h>

#define FTP_URL_MAX          (FP_MAX_PATH * 3 + 512)
#define FTP_CMD_MAX          (FP_MAX_PATH + 64)
#define FTP_UPLOAD_BUF       (4 * 1024 * 1024)
#define FTP_CONNECT_TIMEOUT  20L
#define FTP_RESPONSE_TIMEOUT 60L
#define FTP_RMDIR_MAX_DEPTH  64
#define FTP_ERR_TOO_DEEP     CURLE_RECURSIVE_API_CALL

typedef enum {
    FTP_TLS_NONE,
    FTP_TLS_EXPLICIT,
    FTP_TLS_IMPLICIT,
} ftp_tls_mode_t;

typedef struct {
    CURL* curl;
    char base[320];
    char userpwd[512];
    ftp_tls_mode_t tls;
    int mlsd_state;
    char errbuf[CURL_ERROR_SIZE];
} ftp_conn_t;

typedef struct {
    nexterm_session_t* session;
    nexterm_control_plane_t* cp;
} ftp_thread_args_t;

typedef struct {
    char* data;
    size_t len;
    size_t cap;
    size_t max;
    bool overflow;
} ftp_buf_t;

static void ftp_buf_free(ftp_buf_t* b) {
    free(b->data);
    b->data = NULL;
    b->len = 0;
    b->cap = 0;
}

static bool ftp_buf_append(ftp_buf_t* b, const char* data, size_t len) {
    if (b->max && b->len + len > b->max) {
        b->overflow = true;
        return false;
    }
    if (b->len + len + 1 > b->cap) {
        size_t cap = b->cap ? b->cap : 8192;
        while (cap < b->len + len + 1) cap *= 2;
        char* p = realloc(b->data, cap);
        if (!p) return false;
        b->data = p;
        b->cap = cap;
    }
    memcpy(b->data + b->len, data, len);
    b->len += len;
    b->data[b->len] = '\0';
    return true;
}

static size_t ftp_buf_write_cb(void* contents, size_t size, size_t nmemb, void* userp) {
    size_t total = size * nmemb;
    return ftp_buf_append((ftp_buf_t*)userp, (const char*)contents, total) ? total : 0;
}

bool nexterm_ftp_is_ftp_session(const nexterm_session_t* session) {
    const char* protocol = nexterm_session_get_param(session, "protocol");
    return protocol && (strcmp(protocol, "ftp") == 0 ||
                        strcmp(protocol, "ftps") == 0);
}

static bool ftp_path_is_safe(const char* path) {
    return path && !strpbrk(path, "\r\n");
}

static bool ftp_append(char* out, size_t out_sz, size_t* len, const char* src) {
    size_t n = strlen(src);
    if (*len + n + 1 > out_sz) return false;
    memcpy(out + *len, src, n);
    *len += n;
    out[*len] = '\0';
    return true;
}

static bool ftp_build_url(ftp_conn_t* c, const char* path, bool is_dir,
                          char* out, size_t out_sz) {
    if (!ftp_path_is_safe(path)) return false;

    size_t len = 0;
    out[0] = '\0';
    if (!ftp_append(out, out_sz, &len, c->base)) return false;
    if (!ftp_append(out, out_sz, &len, "/%2F")) return false;

    const char* p = path;
    while (*p == '/') p++;

    bool first = true;
    while (*p) {
        const char* slash = strchr(p, '/');
        size_t seg_len = slash ? (size_t)(slash - p) : strlen(p);

        if (seg_len > 0) {
            char* esc = curl_easy_escape(c->curl, p, (int)seg_len);
            if (!esc) return false;
            bool ok = (first || ftp_append(out, out_sz, &len, "/")) &&
                      ftp_append(out, out_sz, &len, esc);
            curl_free(esc);
            if (!ok) return false;
            first = false;
        }

        if (!slash) break;
        p = slash + 1;
    }

    if (is_dir && !ftp_append(out, out_sz, &len, "/")) return false;
    return true;
}

static size_t ftp_discard_cb(void* contents, size_t size, size_t nmemb, void* userp) {
    (void)contents;
    (void)userp;
    return size * nmemb;
}

static void ftp_setup_common(ftp_conn_t* c, CURL* curl) {
    curl_easy_reset(curl);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, ftp_discard_cb);
    curl_easy_setopt(curl, CURLOPT_HEADERFUNCTION, ftp_discard_cb);
    curl_easy_setopt(curl, CURLOPT_USERPWD, c->userpwd);
    curl_easy_setopt(curl, CURLOPT_NOSIGNAL, 1L);
    curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT, FTP_CONNECT_TIMEOUT);
    curl_easy_setopt(curl, CURLOPT_SERVER_RESPONSE_TIMEOUT, FTP_RESPONSE_TIMEOUT);
    curl_easy_setopt(curl, CURLOPT_FTP_SKIP_PASV_IP, 1L);
    curl_easy_setopt(curl, CURLOPT_ERRORBUFFER, c->errbuf);
    c->errbuf[0] = '\0';

    if (c->tls == FTP_TLS_EXPLICIT)
        curl_easy_setopt(curl, CURLOPT_USE_SSL, (long)CURLUSESSL_ALL);

    if (c->tls != FTP_TLS_NONE) {
        curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 0L);
        curl_easy_setopt(curl, CURLOPT_SSL_VERIFYHOST, 0L);
    }
}

static const char* ftp_strerror(long response) {
    switch (response) {
        case 421: return "Service not available";
        case 425: return "Cannot open data connection";
        case 426: return "Transfer aborted";
        case 430:
        case 530: return "Authentication failed";
        case 450:
        case 550: return "Path does not exist or permission denied";
        case 452: return "No space left";
        case 532: return "Permission denied";
        case 552: return "Quota exceeded";
        case 553: return "Invalid file name";
        case 500:
        case 501:
        case 502:
        case 504: return "Operation not supported by server";
        default:  return NULL;
    }
}

static void ftp_send_curl_error(ftp_conn_t* c, int fd, uint32_t rid, CURLcode rc) {
    long response = 0;
    curl_easy_getinfo(c->curl, CURLINFO_RESPONSE_CODE, &response);

    const char* message = ftp_strerror(response);
    if (!message) message = c->errbuf[0] ? c->errbuf : curl_easy_strerror(rc);

    fp_send_error(fd, rid, message, response > 0 ? (int32_t)response : (int32_t)rc);
}

static CURLcode ftp_run_quote(ftp_conn_t* c, struct curl_slist* cmds, ftp_buf_t* replies) {
    char url[FTP_URL_MAX];
    size_t len = 0;
    url[0] = '\0';
    if (!ftp_append(url, sizeof(url), &len, c->base) ||
        !ftp_append(url, sizeof(url), &len, "/"))
        return CURLE_URL_MALFORMAT;

    ftp_setup_common(c, c->curl);
    curl_easy_setopt(c->curl, CURLOPT_URL, url);
    curl_easy_setopt(c->curl, CURLOPT_NOBODY, 1L);
    curl_easy_setopt(c->curl, CURLOPT_QUOTE, cmds);

    if (replies) {
        curl_easy_setopt(c->curl, CURLOPT_HEADERFUNCTION, ftp_buf_write_cb);
        curl_easy_setopt(c->curl, CURLOPT_HEADERDATA, replies);
    }

    return curl_easy_perform(c->curl);
}

static CURLcode ftp_command(ftp_conn_t* c, const char* cmd, ftp_buf_t* replies) {
    struct curl_slist* cmds = curl_slist_append(NULL, cmd);
    if (!cmds) return CURLE_OUT_OF_MEMORY;
    CURLcode rc = ftp_run_quote(c, cmds, replies);
    curl_slist_free_all(cmds);
    return rc;
}

static CURLcode ftp_command_path(ftp_conn_t* c, const char* verb, const char* path) {
    if (!ftp_path_is_safe(path)) return CURLE_URL_MALFORMAT;

    char cmd[FTP_CMD_MAX];
    snprintf(cmd, sizeof(cmd), "%s %s", verb, path);
    return ftp_command(c, cmd, NULL);
}

static bool ftp_is_dir(ftp_conn_t* c, const char* path) {
    return ftp_command_path(c, "CWD", path) == CURLE_OK;
}

static uint32_t ftp_parse_perm_string(const char* p) {
    uint32_t mode = 0;
    for (int i = 0; i < 9; i++) {
        char ch = p[i];
        if (ch == '-' || ch == ' ' || ch == 'S' || ch == 'T') continue;
        mode |= 1u << (8 - i);
    }
    if (p[2] == 's' || p[2] == 'S') mode |= S_ISUID;
    if (p[5] == 's' || p[5] == 'S') mode |= S_ISGID;
    if (p[8] == 't' || p[8] == 'T') mode |= S_ISVTX;
    return mode;
}

static uint32_t ftp_type_bits(bool is_dir, bool is_symlink) {
    if (is_symlink) return S_IFLNK;
    return is_dir ? S_IFDIR : S_IFREG;
}

static int ftp_month_from_name(const char* name) {
    static const char* months[] = { "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                                    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" };
    for (int i = 0; i < 12; i++)
        if (strncasecmp(name, months[i], 3) == 0) return i;
    return -1;
}

static uint32_t ftp_parse_list_time(const char* month, const char* day,
                                    const char* time_or_year) {
    int mon = ftp_month_from_name(month);
    if (mon < 0) return 0;

    struct tm tm;
    memset(&tm, 0, sizeof(tm));
    tm.tm_mon = mon;
    tm.tm_mday = atoi(day);

    time_t now = time(NULL);
    struct tm now_tm;
    gmtime_r(&now, &now_tm);

    if (strchr(time_or_year, ':')) {
        tm.tm_hour = atoi(time_or_year);
        const char* colon = strchr(time_or_year, ':');
        tm.tm_min = atoi(colon + 1);
        tm.tm_year = now_tm.tm_year;

        time_t candidate = timegm(&tm);
        if (candidate > now + 86400) {
            tm.tm_year--;
            candidate = timegm(&tm);
        }
        return (uint32_t)candidate;
    }

    tm.tm_year = atoi(time_or_year) - 1900;
    time_t parsed = timegm(&tm);
    return parsed > 0 ? (uint32_t)parsed : 0;
}

static const char* ftp_skip_spaces(const char* p) {
    while (*p == ' ' || *p == '\t') p++;
    return p;
}

static const char* ftp_next_field(const char* p, char* out, size_t out_sz) {
    p = ftp_skip_spaces(p);
    size_t i = 0;
    while (*p && *p != ' ' && *p != '\t') {
        if (i + 1 < out_sz) out[i++] = *p;
        p++;
    }
    out[i] = '\0';
    return p;
}

static int ftp_parse_unix_line(const char* line, fp_entries_t* out) {
    if (strlen(line) < 10) return 0;

    char type = line[0];
    if (type != '-' && type != 'd' && type != 'l') return 0;

    bool is_dir = (type == 'd');
    bool is_symlink = (type == 'l');
    uint32_t mode = ftp_parse_perm_string(line + 1);

    const char* p = line;
    while (*p && *p != ' ' && *p != '\t') p++;

    char nlink[32], owner[128], group[128], size[32], month[16], day[16], stamp[16];
    p = ftp_next_field(p, nlink, sizeof(nlink));
    p = ftp_next_field(p, owner, sizeof(owner));
    p = ftp_next_field(p, group, sizeof(group));
    p = ftp_next_field(p, size, sizeof(size));
    p = ftp_next_field(p, month, sizeof(month));
    p = ftp_next_field(p, day, sizeof(day));
    p = ftp_next_field(p, stamp, sizeof(stamp));

    const char* name = ftp_skip_spaces(p);
    if (!*name) return 0;

    char name_buf[FP_MAX_PATH];
    snprintf(name_buf, sizeof(name_buf), "%s", name);

    char* arrow = strstr(name_buf, " -> ");
    if (is_symlink && arrow) *arrow = '\0';

    if (strcmp(name_buf, ".") == 0 || strcmp(name_buf, "..") == 0) return 0;

    return fp_entries_push(out, name_buf, is_dir, is_symlink,
                           strtoull(size, NULL, 10),
                           ftp_parse_list_time(month, day, stamp),
                           mode | ftp_type_bits(is_dir, is_symlink));
}

static int ftp_parse_dos_line(const char* line, fp_entries_t* out) {
    char date[16], stamp[16], size_field[32];
    const char* p = ftp_next_field(line, date, sizeof(date));
    p = ftp_next_field(p, stamp, sizeof(stamp));
    p = ftp_next_field(p, size_field, sizeof(size_field));

    const char* name = ftp_skip_spaces(p);
    if (!*name) return 0;
    if (strcmp(name, ".") == 0 || strcmp(name, "..") == 0) return 0;

    bool is_dir = strcasecmp(size_field, "<DIR>") == 0;
    uint64_t size = is_dir ? 0 : strtoull(size_field, NULL, 10);
    uint32_t mode = (is_dir ? 0755u : 0644u) | ftp_type_bits(is_dir, false);

    struct tm tm;
    memset(&tm, 0, sizeof(tm));
    int month = 0, day = 0, year = 0, hour = 0, minute = 0;
    uint32_t mtime = 0;

    if (sscanf(date, "%d-%d-%d", &month, &day, &year) == 3) {
        tm.tm_mon = month - 1;
        tm.tm_mday = day;
        tm.tm_year = year < 70 ? year + 100 : (year < 100 ? year : year - 1900);

        if (sscanf(stamp, "%d:%d", &hour, &minute) == 2) {
            if (strcasestr(stamp, "PM") && hour != 12) hour += 12;
            if (strcasestr(stamp, "AM") && hour == 12) hour = 0;
            tm.tm_hour = hour;
            tm.tm_min = minute;
        }

        time_t parsed = timegm(&tm);
        if (parsed > 0) mtime = (uint32_t)parsed;
    }

    return fp_entries_push(out, name, is_dir, false, size, mtime, mode);
}

static uint32_t ftp_parse_mlsd_time(const char* value) {
    struct tm tm;
    memset(&tm, 0, sizeof(tm));
    int year = 0, month = 0, day = 0, hour = 0, minute = 0, second = 0;
    if (sscanf(value, "%4d%2d%2d%2d%2d%2d", &year, &month, &day,
               &hour, &minute, &second) != 6)
        return 0;

    tm.tm_year = year - 1900;
    tm.tm_mon = month - 1;
    tm.tm_mday = day;
    tm.tm_hour = hour;
    tm.tm_min = minute;
    tm.tm_sec = second;

    time_t parsed = timegm(&tm);
    return parsed > 0 ? (uint32_t)parsed : 0;
}

static int ftp_parse_mlsd_line(const char* line, fp_entries_t* out) {
    const char* sep = strstr(line, "; ");
    if (!sep) return 0;

    const char* name = sep + 2;
    if (!*name) return 0;

    char facts[1024];
    size_t facts_len = (size_t)(sep - line);
    if (facts_len >= sizeof(facts)) facts_len = sizeof(facts) - 1;
    memcpy(facts, line, facts_len);
    facts[facts_len] = '\0';

    bool is_dir = false;
    bool is_symlink = false;
    bool skip = false;
    uint64_t size = 0;
    uint32_t mtime = 0;
    uint32_t mode = 0;
    bool have_mode = false;

    char* saveptr = NULL;
    for (char* fact = strtok_r(facts, ";", &saveptr); fact;
         fact = strtok_r(NULL, ";", &saveptr)) {
        char* eq = strchr(fact, '=');
        if (!eq) continue;
        *eq = '\0';
        const char* key = fact;
        const char* value = eq + 1;

        if (strcasecmp(key, "type") == 0) {
            if (strcasecmp(value, "dir") == 0) is_dir = true;
            else if (strcasecmp(value, "cdir") == 0 || strcasecmp(value, "pdir") == 0)
                skip = true;
            else if (strncasecmp(value, "OS.unix=slink", 13) == 0 ||
                     strcasecmp(value, "link") == 0)
                is_symlink = true;
        } else if (strcasecmp(key, "size") == 0 || strcasecmp(key, "sizd") == 0) {
            size = strtoull(value, NULL, 10);
        } else if (strcasecmp(key, "modify") == 0) {
            mtime = ftp_parse_mlsd_time(value);
        } else if (strcasecmp(key, "UNIX.mode") == 0) {
            mode = (uint32_t)strtoul(value, NULL, 8);
            have_mode = true;
        }
    }

    if (skip) return 0;
    if (strcmp(name, ".") == 0 || strcmp(name, "..") == 0) return 0;
    if (!have_mode) mode = is_dir ? 0755u : 0644u;

    return fp_entries_push(out, name, is_dir, is_symlink, size, mtime,
                           mode | ftp_type_bits(is_dir, is_symlink));
}

typedef int (*ftp_line_parser_t)(const char* line, fp_entries_t* out);

static void ftp_parse_listing(const char* text, ftp_line_parser_t parser,
                              fp_entries_t* out) {
    const char* p = text;
    char line[FP_MAX_PATH];

    while (*p) {
        const char* nl = strchr(p, '\n');
        size_t len = nl ? (size_t)(nl - p) : strlen(p);
        while (len > 0 && (p[len - 1] == '\r' || p[len - 1] == ' ')) len--;

        if (len > 0 && len < sizeof(line)) {
            memcpy(line, p, len);
            line[len] = '\0';
            parser(line, out);
        }

        if (!nl) break;
        p = nl + 1;
    }
}

static CURLcode ftp_fetch_listing(ftp_conn_t* c, const char* path,
                                  const char* custom_request, ftp_buf_t* buf) {
    char url[FTP_URL_MAX];
    if (!ftp_build_url(c, path, true, url, sizeof(url)))
        return CURLE_URL_MALFORMAT;

    ftp_setup_common(c, c->curl);
    curl_easy_setopt(c->curl, CURLOPT_URL, url);
    curl_easy_setopt(c->curl, CURLOPT_WRITEFUNCTION, ftp_buf_write_cb);
    curl_easy_setopt(c->curl, CURLOPT_WRITEDATA, buf);
    if (custom_request)
        curl_easy_setopt(c->curl, CURLOPT_CUSTOMREQUEST, custom_request);

    return curl_easy_perform(c->curl);
}

static CURLcode ftp_list_dir(ftp_conn_t* c, const char* path, fp_entries_t* out) {
    if (c->mlsd_state >= 0) {
        ftp_buf_t buf = {0};
        CURLcode rc = ftp_fetch_listing(c, path, "MLSD", &buf);
        if (rc == CURLE_OK) {
            c->mlsd_state = 1;
            ftp_parse_listing(buf.data ? buf.data : "", ftp_parse_mlsd_line, out);
            ftp_buf_free(&buf);
            return CURLE_OK;
        }
        ftp_buf_free(&buf);

        long response = 0;
        curl_easy_getinfo(c->curl, CURLINFO_RESPONSE_CODE, &response);
        if (c->mlsd_state == 1 || response < 500 || response > 504) return rc;

        LOG_DEBUG("FTP: server rejected MLSD (%ld), falling back to LIST", response);
        c->mlsd_state = -1;
    }

    ftp_buf_t buf = {0};
    CURLcode rc = ftp_fetch_listing(c, path, NULL, &buf);
    if (rc != CURLE_OK) {
        ftp_buf_free(&buf);
        return rc;
    }

    const char* text = buf.data ? buf.data : "";
    ftp_parse_listing(text, ftp_parse_unix_line, out);
    if (out->count == 0)
        ftp_parse_listing(text, ftp_parse_dos_line, out);

    ftp_buf_free(&buf);
    return CURLE_OK;
}

static void ftp_normalize_path(const char* path, char* out, size_t out_sz) {
    if (!path || !*path || strcmp(path, ".") == 0) {
        snprintf(out, out_sz, "/");
        return;
    }

    snprintf(out, out_sz, "%s", path);
    size_t len = strlen(out);
    while (len > 1 && out[len - 1] == '/') out[--len] = '\0';
}

static void ftp_split_parent(const char* path, char* parent, size_t parent_sz,
                             char* name, size_t name_sz) {
    const char* slash = strrchr(path, '/');
    if (!slash) {
        snprintf(parent, parent_sz, "/");
        snprintf(name, name_sz, "%s", path);
        return;
    }

    size_t parent_len = (size_t)(slash - path);
    if (parent_len == 0) {
        snprintf(parent, parent_sz, "/");
    } else {
        if (parent_len >= parent_sz) parent_len = parent_sz - 1;
        memcpy(parent, path, parent_len);
        parent[parent_len] = '\0';
    }
    snprintf(name, name_sz, "%s", slash + 1);
}

static void handle_list_dir(ftp_conn_t* c, int fd, uint32_t rid, const char* path) {
    char normalized[FP_MAX_PATH];
    ftp_normalize_path(path, normalized, sizeof(normalized));

    fp_entries_t entries = {0};
    CURLcode rc = ftp_list_dir(c, normalized, &entries);
    if (rc != CURLE_OK) {
        ftp_send_curl_error(c, fd, rid, rc);
        fp_entries_free(&entries);
        return;
    }

    fp_send_dir_list(fd, rid, &entries);
    fp_entries_free(&entries);
}

static void handle_stat(ftp_conn_t* c, int fd, uint32_t rid, const char* path) {
    char normalized[FP_MAX_PATH];
    ftp_normalize_path(path, normalized, sizeof(normalized));

    fp_stat_t st;
    memset(&st, 0, sizeof(st));

    if (strcmp(normalized, "/") == 0) {
        st.is_dir = true;
        st.mode = 0755u | S_IFDIR;
        fp_send_stat(fd, rid, &st);
        return;
    }

    char parent[FP_MAX_PATH];
    char name[FP_MAX_PATH];
    ftp_split_parent(normalized, parent, sizeof(parent), name, sizeof(name));

    fp_entries_t entries = {0};
    CURLcode rc = ftp_list_dir(c, parent, &entries);
    if (rc != CURLE_OK) {
        ftp_send_curl_error(c, fd, rid, rc);
        fp_entries_free(&entries);
        return;
    }

    for (size_t i = 0; i < entries.count; i++) {
        if (strcmp(entries.items[i].name, name) != 0) continue;

        st.size = entries.items[i].size;
        st.mode = entries.items[i].mode;
        st.mtime = entries.items[i].mtime;
        st.atime = entries.items[i].mtime;
        st.is_dir = entries.items[i].is_dir;
        fp_send_stat(fd, rid, &st);
        fp_entries_free(&entries);
        return;
    }

    fp_entries_free(&entries);
    fp_send_error(fd, rid, "Path does not exist", 550);
}

static void handle_simple_command(ftp_conn_t* c, int fd, uint32_t rid,
                                  const char* verb, const char* path) {
    CURLcode rc = ftp_command_path(c, verb, path);
    if (rc != CURLE_OK)
        ftp_send_curl_error(c, fd, rid, rc);
    else
        fp_send_ok(fd, rid);
}

static CURLcode ftp_recursive_rmdir(ftp_conn_t* c, const char* path, int depth) {
    if (depth > FTP_RMDIR_MAX_DEPTH) {
        LOG_WARN("FTP: recursive delete exceeded max depth at %s", path);
        return FTP_ERR_TOO_DEEP;
    }

    fp_entries_t entries = {0};
    CURLcode rc = ftp_list_dir(c, path, &entries);
    if (rc != CURLE_OK) {
        fp_entries_free(&entries);
        return rc;
    }

    for (size_t i = 0; i < entries.count; i++) {
        char child[FP_MAX_PATH];
        fp_join_path(path, entries.items[i].name, child, sizeof(child));

        if (entries.items[i].is_dir && !entries.items[i].is_symlink)
            ftp_recursive_rmdir(c, child, depth + 1);
        else
            ftp_command_path(c, "DELE", child);
    }

    fp_entries_free(&entries);
    return ftp_command_path(c, "RMD", path);
}

static void handle_rmdir(ftp_conn_t* c, int fd, uint32_t rid, const char* path,
                         bool recursive) {
    CURLcode rc = recursive ? ftp_recursive_rmdir(c, path, 0)
                            : ftp_command_path(c, "RMD", path);
    if (rc == FTP_ERR_TOO_DEEP)
        fp_send_error(fd, rid, "Directory tree is too deep to delete", -1);
    else if (rc != CURLE_OK)
        ftp_send_curl_error(c, fd, rid, rc);
    else
        fp_send_ok(fd, rid);
}

static void handle_rename(ftp_conn_t* c, int fd, uint32_t rid,
                          const char* old_path, const char* new_path) {
    if (!ftp_path_is_safe(old_path) || !ftp_path_is_safe(new_path)) {
        fp_send_error(fd, rid, "Invalid path", -1);
        return;
    }

    char from[FTP_CMD_MAX];
    char to[FTP_CMD_MAX];
    snprintf(from, sizeof(from), "RNFR %s", old_path);
    snprintf(to, sizeof(to), "RNTO %s", new_path);

    struct curl_slist* cmds = curl_slist_append(NULL, from);
    if (cmds) cmds = curl_slist_append(cmds, to);
    if (!cmds) {
        fp_send_error(fd, rid, "Out of memory", -1);
        return;
    }

    CURLcode rc = ftp_run_quote(c, cmds, NULL);
    curl_slist_free_all(cmds);

    if (rc != CURLE_OK)
        ftp_send_curl_error(c, fd, rid, rc);
    else
        fp_send_ok(fd, rid);
}

static void handle_chmod(ftp_conn_t* c, int fd, uint32_t rid, const char* path,
                         uint32_t mode) {
    if (!ftp_path_is_safe(path)) {
        fp_send_error(fd, rid, "Invalid path", -1);
        return;
    }

    char cmd[FTP_CMD_MAX];
    snprintf(cmd, sizeof(cmd), "SITE CHMOD %04o %s", mode & 07777, path);

    CURLcode rc = ftp_command(c, cmd, NULL);
    if (rc != CURLE_OK)
        ftp_send_curl_error(c, fd, rid, rc);
    else
        fp_send_ok(fd, rid);
}

static bool ftp_parse_pwd_reply(const char* replies, char* out, size_t out_sz) {
    const char* line = strstr(replies, "257 ");
    if (!line) return false;

    const char* quote = strchr(line, '"');
    if (!quote) return false;
    quote++;

    size_t len = 0;
    while (*quote && len + 1 < out_sz) {
        if (*quote == '"') {
            if (quote[1] != '"') break;
            quote++;
        }
        out[len++] = *quote++;
    }
    out[len] = '\0';
    return len > 0;
}

static bool ftp_get_cwd(ftp_conn_t* c, char* out, size_t out_sz) {
    ftp_buf_t replies = {0};
    CURLcode rc = ftp_command(c, "PWD", &replies);
    bool ok = rc == CURLE_OK && replies.data &&
              ftp_parse_pwd_reply(replies.data, out, out_sz);
    ftp_buf_free(&replies);
    return ok;
}

static void handle_realpath(ftp_conn_t* c, int fd, uint32_t rid, const char* path) {
    char resolved[FP_MAX_PATH];

    if (!path || !*path || strcmp(path, ".") == 0 || strcmp(path, "~") == 0) {
        if (!ftp_get_cwd(c, resolved, sizeof(resolved)))
            snprintf(resolved, sizeof(resolved), "/");
        fp_send_realpath(fd, rid, resolved, true);
        return;
    }

    ftp_normalize_path(path, resolved, sizeof(resolved));
    fp_send_realpath(fd, rid, resolved, ftp_is_dir(c, resolved));
}

static bool ftp_get_size(ftp_conn_t* c, const char* path, uint64_t* out_size) {
    char url[FTP_URL_MAX];
    if (!ftp_build_url(c, path, false, url, sizeof(url))) return false;

    ftp_setup_common(c, c->curl);
    curl_easy_setopt(c->curl, CURLOPT_URL, url);
    curl_easy_setopt(c->curl, CURLOPT_NOBODY, 1L);

    if (curl_easy_perform(c->curl) != CURLE_OK) return false;

    curl_off_t size = -1;
    if (curl_easy_getinfo(c->curl, CURLINFO_CONTENT_LENGTH_DOWNLOAD_T, &size) != CURLE_OK ||
        size < 0)
        return false;

    *out_size = (uint64_t)size;
    return true;
}

typedef struct {
    int fd;
    uint32_t rid;
    uint64_t total;
    uint8_t* buf;
    size_t len;
    bool failed;
} ftp_download_t;

static bool ftp_download_flush(ftp_download_t* d) {
    if (d->len == 0) return true;
    if (fp_send_file_data(d->fd, d->rid, d->buf, d->len, d->total) != 0) {
        d->failed = true;
        return false;
    }
    d->len = 0;
    return true;
}

static size_t ftp_download_cb(void* contents, size_t size, size_t nmemb, void* userp) {
    ftp_download_t* d = (ftp_download_t*)userp;
    size_t total = size * nmemb;
    size_t offset = 0;

    while (offset < total) {
        size_t space = FP_CHUNK_SIZE - d->len;
        size_t take = total - offset < space ? total - offset : space;
        memcpy(d->buf + d->len, (const char*)contents + offset, take);
        d->len += take;
        offset += take;

        if (d->len == FP_CHUNK_SIZE && !ftp_download_flush(d)) return 0;
    }

    return total;
}

static void handle_read_file(ftp_conn_t* c, int fd, uint32_t rid, const char* path) {
    char url[FTP_URL_MAX];
    if (!ftp_build_url(c, path, false, url, sizeof(url))) {
        fp_send_error(fd, rid, "Invalid path", -1);
        return;
    }

    ftp_download_t dl;
    memset(&dl, 0, sizeof(dl));
    dl.fd = fd;
    dl.rid = rid;
    dl.buf = malloc(FP_CHUNK_SIZE);
    if (!dl.buf) {
        fp_send_error(fd, rid, "Out of memory", -1);
        return;
    }
    ftp_get_size(c, path, &dl.total);

    ftp_setup_common(c, c->curl);
    curl_easy_setopt(c->curl, CURLOPT_URL, url);
    curl_easy_setopt(c->curl, CURLOPT_WRITEFUNCTION, ftp_download_cb);
    curl_easy_setopt(c->curl, CURLOPT_WRITEDATA, &dl);

    CURLcode rc = curl_easy_perform(c->curl);

    if (rc != CURLE_OK) {
        if (!dl.failed) ftp_send_curl_error(c, fd, rid, rc);
        free(dl.buf);
        return;
    }

    if (!ftp_download_flush(&dl)) {
        free(dl.buf);
        return;
    }

    free(dl.buf);
    fp_send_file_end(fd, rid);
}

static void handle_thumbnail(ftp_conn_t* c, int fd, uint32_t rid, const char* path,
                             uint32_t size) {
    char url[FTP_URL_MAX];
    if (!ftp_build_url(c, path, false, url, sizeof(url))) {
        fp_send_error(fd, rid, "Invalid path", -1);
        return;
    }

    ftp_buf_t buf = {0};
    buf.max = FP_THUMB_MAX_BYTES;

    ftp_setup_common(c, c->curl);
    curl_easy_setopt(c->curl, CURLOPT_URL, url);
    curl_easy_setopt(c->curl, CURLOPT_WRITEFUNCTION, ftp_buf_write_cb);
    curl_easy_setopt(c->curl, CURLOPT_WRITEDATA, &buf);

    CURLcode rc = curl_easy_perform(c->curl);
    if (rc != CURLE_OK) {
        if (buf.overflow)
            fp_send_error(fd, rid, "Image too large for thumbnail", -1);
        else
            ftp_send_curl_error(c, fd, rid, rc);
        ftp_buf_free(&buf);
        return;
    }

    if (buf.len == 0) {
        fp_send_error(fd, rid, "Failed to generate thumbnail", -1);
        ftp_buf_free(&buf);
        return;
    }

    uint8_t* jpeg = NULL;
    size_t jpeg_len = 0;
    int ow = 0, oh = 0;
    if (nexterm_make_thumbnail((const uint8_t*)buf.data, buf.len, (int)size,
                               &jpeg, &jpeg_len, &ow, &oh) != 0) {
        fp_send_error(fd, rid, "Failed to generate thumbnail", -1);
        ftp_buf_free(&buf);
        return;
    }
    ftp_buf_free(&buf);

    fp_send_thumbnail(fd, rid, jpeg, jpeg_len, (uint32_t)ow, (uint32_t)oh);
    free(jpeg);
}

static void handle_search_dirs(ftp_conn_t* c, int fd, uint32_t rid,
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

    const char* base = base_path[0] ? base_path : "/";

    fp_entries_t entries = {0};
    if (ftp_list_dir(c, base, &entries) == CURLE_OK) {
        for (size_t i = 0; i < entries.count && ctx.count < ctx.max_results; i++) {
            if (fp_monotonic_ms() >= ctx.deadline) {
                ctx.timed_out = true;
                break;
            }
            if (!entries.items[i].is_dir) continue;
            if (!inside && !fp_name_matches(entries.items[i].name, search_term)) continue;

            fp_join_path(base, entries.items[i].name, ctx.paths[ctx.count],
                         FP_MAX_PATH);
            ctx.count++;
        }
    }
    fp_entries_free(&entries);

    if (ctx.timed_out)
        LOG_WARN("FTP: search timed out after %u ms, returning %d partial result(s)",
                 timeout_ms, ctx.count);

    fp_send_search_result(fd, rid, &ctx);
}

typedef struct {
    CURL* curl;
    uint32_t rid;
    pthread_t thread;
    pthread_mutex_t mutex;
    pthread_cond_t cond;
    uint8_t* buf;
    size_t cap;
    size_t head;
    size_t len;
    bool eof;
    bool done;
    bool failed;
    bool active;
    char error[CURL_ERROR_SIZE];
} ftp_upload_t;

static size_t ftp_upload_read_cb(char* dest, size_t size, size_t nmemb, void* userp) {
    ftp_upload_t* up = (ftp_upload_t*)userp;
    size_t want = size * nmemb;

    pthread_mutex_lock(&up->mutex);
    while (up->len == 0 && !up->eof)
        pthread_cond_wait(&up->cond, &up->mutex);

    if (up->len == 0) {
        pthread_mutex_unlock(&up->mutex);
        return 0;
    }

    size_t n = want < up->len ? want : up->len;
    memcpy(dest, up->buf + up->head, n);
    up->head += n;
    up->len -= n;
    if (up->len == 0) up->head = 0;

    pthread_cond_broadcast(&up->cond);
    pthread_mutex_unlock(&up->mutex);
    return n;
}

static void* ftp_upload_thread(void* arg) {
    ftp_upload_t* up = (ftp_upload_t*)arg;
    CURLcode rc = curl_easy_perform(up->curl);

    pthread_mutex_lock(&up->mutex);
    up->done = true;
    if (rc != CURLE_OK) {
        up->failed = true;
        if (!up->error[0])
            snprintf(up->error, sizeof(up->error), "%s", curl_easy_strerror(rc));
    }
    pthread_cond_broadcast(&up->cond);
    pthread_mutex_unlock(&up->mutex);
    return NULL;
}

static void ftp_upload_dispose(ftp_upload_t* up) {
    if (up->curl) {
        curl_easy_cleanup(up->curl);
        up->curl = NULL;
    }
    free(up->buf);
    up->buf = NULL;
    pthread_mutex_destroy(&up->mutex);
    pthread_cond_destroy(&up->cond);
    up->active = false;
}

static void ftp_upload_abort(ftp_upload_t* up) {
    if (!up->active) return;

    pthread_mutex_lock(&up->mutex);
    up->eof = true;
    pthread_cond_broadcast(&up->cond);
    pthread_mutex_unlock(&up->mutex);

    pthread_join(up->thread, NULL);
    ftp_upload_dispose(up);
}

static ftp_upload_t* handle_write_begin(ftp_conn_t* c, int fd, uint32_t rid,
                                        const char* path) {
    char url[FTP_URL_MAX];
    if (!ftp_build_url(c, path, false, url, sizeof(url))) {
        fp_send_error(fd, rid, "Invalid path", -1);
        return NULL;
    }

    ftp_upload_t* up = calloc(1, sizeof(ftp_upload_t));
    if (!up) {
        fp_send_error(fd, rid, "Out of memory", -1);
        return NULL;
    }

    up->buf = malloc(FTP_UPLOAD_BUF);
    up->curl = curl_easy_init();
    if (!up->buf || !up->curl) {
        free(up->buf);
        if (up->curl) curl_easy_cleanup(up->curl);
        free(up);
        fp_send_error(fd, rid, "Out of memory", -1);
        return NULL;
    }

    up->cap = FTP_UPLOAD_BUF;
    up->rid = rid;
    pthread_mutex_init(&up->mutex, NULL);
    pthread_cond_init(&up->cond, NULL);

    ftp_setup_common(c, up->curl);
    curl_easy_setopt(up->curl, CURLOPT_URL, url);
    curl_easy_setopt(up->curl, CURLOPT_UPLOAD, 1L);
    curl_easy_setopt(up->curl, CURLOPT_READFUNCTION, ftp_upload_read_cb);
    curl_easy_setopt(up->curl, CURLOPT_READDATA, up);
    curl_easy_setopt(up->curl, CURLOPT_ERRORBUFFER, up->error);

    if (pthread_create(&up->thread, NULL, ftp_upload_thread, up) != 0) {
        ftp_upload_dispose(up);
        free(up);
        fp_send_error(fd, rid, "Failed to start upload", -1);
        return NULL;
    }

    up->active = true;
    fp_send_ok(fd, rid);
    return up;
}

static int ftp_upload_push(ftp_upload_t* up, const uint8_t* data, size_t len) {
    pthread_mutex_lock(&up->mutex);

    while (len > 0 && !up->failed && !up->done) {
        if (up->head > 0 && up->len < up->cap) {
            memmove(up->buf, up->buf + up->head, up->len);
            up->head = 0;
        }

        size_t space = up->cap - up->head - up->len;
        if (space == 0) {
            pthread_cond_wait(&up->cond, &up->mutex);
            continue;
        }

        size_t n = space < len ? space : len;
        memcpy(up->buf + up->head + up->len, data, n);
        up->len += n;
        data += n;
        len -= n;
        pthread_cond_broadcast(&up->cond);
    }

    int rc = (up->failed || (up->done && len > 0)) ? -1 : 0;
    pthread_mutex_unlock(&up->mutex);
    return rc;
}

static void handle_write_end(ftp_upload_t* up, int fd) {
    pthread_mutex_lock(&up->mutex);
    up->eof = true;
    pthread_cond_broadcast(&up->cond);
    pthread_mutex_unlock(&up->mutex);

    pthread_join(up->thread, NULL);

    bool failed = up->failed;
    char error[CURL_ERROR_SIZE];
    snprintf(error, sizeof(error), "%s", up->error);
    uint32_t rid = up->rid;

    ftp_upload_dispose(up);

    if (failed)
        fp_send_error(fd, rid, error[0] ? error : "Upload failed", -1);
    else
        fp_send_ok(fd, rid);
}

static const char* extract_path_req(Nexterm_SftpProtocol_SftpMessage_table_t msg) {
    Nexterm_SftpProtocol_PathReq_table_t req = Nexterm_SftpProtocol_SftpMessage_path_req(msg);
    return req ? Nexterm_SftpProtocol_PathReq_path(req) : NULL;
}

static void dispatch_path_op(Nexterm_SftpProtocol_SftpMsgType_enum_t mt,
                             ftp_conn_t* c, int data_fd, uint32_t rid,
                             Nexterm_SftpProtocol_SftpMessage_table_t msg) {
    const char* path = extract_path_req(msg);
    if (!path) { fp_send_error(data_fd, rid, "Missing path", -1); return; }

    switch (mt) {
        case Nexterm_SftpProtocol_SftpMsgType_ListDir:
            handle_list_dir(c, data_fd, rid, path); return;
        case Nexterm_SftpProtocol_SftpMsgType_Stat:
            handle_stat(c, data_fd, rid, path); return;
        case Nexterm_SftpProtocol_SftpMsgType_Mkdir:
            handle_simple_command(c, data_fd, rid, "MKD", path); return;
        case Nexterm_SftpProtocol_SftpMsgType_Unlink:
            handle_simple_command(c, data_fd, rid, "DELE", path); return;
        case Nexterm_SftpProtocol_SftpMsgType_Realpath:
            handle_realpath(c, data_fd, rid, path); return;
        case Nexterm_SftpProtocol_SftpMsgType_ReadFile:
            handle_read_file(c, data_fd, rid, path); return;
        default: return;
    }
}

static void dispatch_write_op(Nexterm_SftpProtocol_SftpMsgType_enum_t mt,
                              ftp_conn_t* c, int data_fd, uint32_t rid,
                              Nexterm_SftpProtocol_SftpMessage_table_t msg,
                              ftp_upload_t** upload) {
    if (mt == Nexterm_SftpProtocol_SftpMsgType_WriteData) {
        if (!*upload) {
            fp_send_error(data_fd, rid, "No write in progress", -1);
            return;
        }

        Nexterm_SftpProtocol_WriteDataReq_table_t req =
            Nexterm_SftpProtocol_SftpMessage_write_data_req(msg);
        if (!req) return;

        flatbuffers_uint8_vec_t data = Nexterm_SftpProtocol_WriteDataReq_data(req);
        size_t dlen = flatbuffers_uint8_vec_len(data);
        if (dlen == 0) return;

        ftp_upload_push(*upload, data, dlen);
        return;
    }

    if (mt == Nexterm_SftpProtocol_SftpMsgType_WriteEnd) {
        if (*upload) {
            handle_write_end(*upload, data_fd);
            free(*upload);
            *upload = NULL;
        }
        return;
    }

    if (*upload) {
        ftp_upload_abort(*upload);
        free(*upload);
        *upload = NULL;
    }

    Nexterm_SftpProtocol_WriteBeginReq_table_t req =
        Nexterm_SftpProtocol_SftpMessage_write_begin_req(msg);
    const char* path = req ? Nexterm_SftpProtocol_WriteBeginReq_path(req) : NULL;
    if (!path) { fp_send_error(data_fd, rid, "Missing path", -1); return; }

    *upload = handle_write_begin(c, data_fd, rid, path);
}

static void dispatch_rmdir(ftp_conn_t* c, int data_fd, uint32_t rid,
                           Nexterm_SftpProtocol_SftpMessage_table_t msg) {
    Nexterm_SftpProtocol_RmdirReq_table_t req = Nexterm_SftpProtocol_SftpMessage_rmdir_req(msg);
    const char* path = req ? Nexterm_SftpProtocol_RmdirReq_path(req) : NULL;
    bool rec = req ? Nexterm_SftpProtocol_RmdirReq_recursive(req) : false;
    if (!path) { fp_send_error(data_fd, rid, "Missing path", -1); return; }
    handle_rmdir(c, data_fd, rid, path, rec);
}

static void dispatch_rename(ftp_conn_t* c, int data_fd, uint32_t rid,
                            Nexterm_SftpProtocol_SftpMessage_table_t msg) {
    Nexterm_SftpProtocol_RenameReq_table_t req = Nexterm_SftpProtocol_SftpMessage_rename_req(msg);
    const char* old_path = req ? Nexterm_SftpProtocol_RenameReq_old_path(req) : NULL;
    const char* new_path = req ? Nexterm_SftpProtocol_RenameReq_new_path(req) : NULL;
    if (!old_path || !new_path) { fp_send_error(data_fd, rid, "Missing paths", -1); return; }
    handle_rename(c, data_fd, rid, old_path, new_path);
}

static void dispatch_chmod(ftp_conn_t* c, int data_fd, uint32_t rid,
                           Nexterm_SftpProtocol_SftpMessage_table_t msg) {
    Nexterm_SftpProtocol_ChmodReq_table_t req = Nexterm_SftpProtocol_SftpMessage_chmod_req(msg);
    const char* path = req ? Nexterm_SftpProtocol_ChmodReq_path(req) : NULL;
    uint32_t mode = req ? Nexterm_SftpProtocol_ChmodReq_mode(req) : 0;
    if (!path) { fp_send_error(data_fd, rid, "Missing path", -1); return; }
    handle_chmod(c, data_fd, rid, path, mode);
}

static void dispatch_search(ftp_conn_t* c, int data_fd, uint32_t rid,
                            Nexterm_SftpProtocol_SftpMessage_table_t msg) {
    Nexterm_SftpProtocol_SearchReq_table_t req = Nexterm_SftpProtocol_SftpMessage_search_req(msg);
    const char* sp = req ? Nexterm_SftpProtocol_SearchReq_search_path(req) : NULL;
    uint32_t max = req ? Nexterm_SftpProtocol_SearchReq_max_results(req) : FP_SEARCH_MAX;
    uint32_t timeout_ms = req ? Nexterm_SftpProtocol_SearchReq_timeout_ms(req) : 0;
    if (!sp) { fp_send_error(data_fd, rid, "Missing search path", -1); return; }
    if (timeout_ms == 0) timeout_ms = 30000;
    handle_search_dirs(c, data_fd, rid, sp, max, timeout_ms);
}

static void dispatch_thumbnail(ftp_conn_t* c, int data_fd, uint32_t rid,
                               Nexterm_SftpProtocol_SftpMessage_table_t msg) {
    Nexterm_SftpProtocol_ThumbnailReq_table_t req = Nexterm_SftpProtocol_SftpMessage_thumbnail_req(msg);
    const char* path = req ? Nexterm_SftpProtocol_ThumbnailReq_path(req) : NULL;
    uint32_t size = req ? Nexterm_SftpProtocol_ThumbnailReq_size(req) : 100;
    if (!path) { fp_send_error(data_fd, rid, "Missing path", -1); return; }
    handle_thumbnail(c, data_fd, rid, path, size);
}

static void ftp_dispatch_message(ftp_conn_t* c, int data_fd,
                                 Nexterm_SftpProtocol_SftpMessage_table_t msg,
                                 ftp_upload_t** upload) {
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
            dispatch_path_op(mt, c, data_fd, rid, msg);
            return;

        case Nexterm_SftpProtocol_SftpMsgType_WriteBegin:
        case Nexterm_SftpProtocol_SftpMsgType_WriteData:
        case Nexterm_SftpProtocol_SftpMsgType_WriteEnd:
            dispatch_write_op(mt, c, data_fd, rid, msg, upload);
            return;

        case Nexterm_SftpProtocol_SftpMsgType_Rmdir:
            dispatch_rmdir(c, data_fd, rid, msg); return;
        case Nexterm_SftpProtocol_SftpMsgType_Rename:
            dispatch_rename(c, data_fd, rid, msg); return;
        case Nexterm_SftpProtocol_SftpMsgType_Chmod:
            dispatch_chmod(c, data_fd, rid, msg); return;
        case Nexterm_SftpProtocol_SftpMsgType_SearchDirs:
            dispatch_search(c, data_fd, rid, msg); return;
        case Nexterm_SftpProtocol_SftpMsgType_Thumbnail:
            dispatch_thumbnail(c, data_fd, rid, msg); return;

        case Nexterm_SftpProtocol_SftpMsgType_Exec:
            fp_send_exec_result(data_fd, rid, "",
                                "Command execution is not available over FTP", 127);
            return;

        default:
            LOG_WARN("FTP: unknown msg_type %d", mt);
            fp_send_error(data_fd, rid, "Unknown operation", -1);
            return;
    }
}

static void ftp_request_loop(nexterm_session_t* session, ftp_conn_t* c, int data_fd) {
    ftp_upload_t* upload = NULL;

    while (session->state == SESSION_STATE_ACTIVE) {
        struct pollfd pfd = { .fd = data_fd, .events = POLLIN, .revents = 0 };
        int ret = poll(&pfd, 1, 1000);
        if (ret == 0) continue;
        if (ret < 0) { if (errno == EINTR) continue; break; }
        if (pfd.revents & (POLLERR | POLLHUP | POLLNVAL)) break;

        uint32_t payload_len;
        uint8_t* payload = nexterm_read_frame(data_fd, FP_MAX_FRAME, &payload_len);
        if (!payload) {
            LOG_DEBUG("FTP session %s: connection closed or read error",
                      session->session_id);
            break;
        }

        Nexterm_SftpProtocol_SftpMessage_table_t msg =
            Nexterm_SftpProtocol_SftpMessage_as_root(payload);
        if (!msg) {
            LOG_WARN("FTP session %s: invalid FlatBuffers message", session->session_id);
            free(payload);
            continue;
        }

        ftp_dispatch_message(c, data_fd, msg, &upload);
        free(payload);
    }

    if (upload) {
        ftp_upload_abort(upload);
        free(upload);
    }
}

static ftp_tls_mode_t ftp_resolve_tls_mode(const nexterm_session_t* session) {
    const char* protocol = nexterm_session_get_param(session, "protocol");
    if (!protocol) return FTP_TLS_NONE;

    if (strcmp(protocol, "ftps") == 0)
        return session->port == 990 ? FTP_TLS_IMPLICIT : FTP_TLS_EXPLICIT;
    return FTP_TLS_NONE;
}

static const char* ftp_tls_label(ftp_tls_mode_t tls) {
    switch (tls) {
        case FTP_TLS_IMPLICIT: return "FTPS (implicit)";
        case FTP_TLS_EXPLICIT: return "FTPS (explicit)";
        default:               return "FTP";
    }
}

static void* ftp_session_thread(void* arg) {
    ftp_thread_args_t* args = (ftp_thread_args_t*)arg;
    nexterm_session_t* session = args->session;
    nexterm_control_plane_t* cp = args->cp;
    int data_fd = -1;
    ftp_conn_t conn;

    memset(&conn, 0, sizeof(conn));
    session->state = SESSION_STATE_CONNECTING;

    const char* username = nexterm_session_get_param(session, "username");
    const char* password = nexterm_session_get_param(session, "password");

    conn.tls = ftp_resolve_tls_mode(session);

    if (!username || strlen(username) == 0) {
        username = "anonymous";
        if (!password) password = "anonymous@";
    }

    snprintf(conn.base, sizeof(conn.base), "%s://%s:%u",
             conn.tls == FTP_TLS_IMPLICIT ? "ftps" : "ftp",
             session->host, session->port ? session->port : 21);
    snprintf(conn.userpwd, sizeof(conn.userpwd), "%s:%s", username,
             password ? password : "");

    LOG_INFO("FTP session %s: connecting to %s:%u as %s (%s)",
             session->session_id, session->host, session->port, username,
             ftp_tls_label(conn.tls));

    data_fd = nexterm_cp_open_data_connection(cp, session->session_id);
    if (data_fd < 0) {
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Failed to open data connection", NULL);
        goto cleanup;
    }

    conn.curl = curl_easy_init();
    if (!conn.curl) {
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       "Failed to initialize FTP client", NULL);
        goto cleanup;
    }

    char cwd[FP_MAX_PATH];
    if (!ftp_get_cwd(&conn, cwd, sizeof(cwd))) {
        LOG_ERROR("FTP session %s: login failed: %s", session->session_id,
                  conn.errbuf[0] ? conn.errbuf : "unknown error");
        nexterm_cp_send_session_result(cp, session->session_id, false,
                                       conn.errbuf[0] ? conn.errbuf
                                                      : "FTP authentication failed",
                                       NULL);
        goto cleanup;
    }

    session->state = SESSION_STATE_ACTIVE;
    nexterm_cp_send_session_result(cp, session->session_id, true, NULL, NULL);

    if (fp_send_ready(data_fd) != 0) {
        LOG_ERROR("FTP session %s: failed to send Ready", session->session_id);
        goto cleanup;
    }

    LOG_INFO("FTP session %s active (target=%s:%u, user=%s, cwd=%.256s)",
             session->session_id, session->host, session->port, username, cwd);

    ftp_request_loop(session, &conn, data_fd);

    LOG_INFO("FTP session %s ending", session->session_id);

cleanup:
    if (conn.curl) curl_easy_cleanup(conn.curl);
    if (data_fd >= 0) close(data_fd);

    char sid[MAX_SESSION_ID_LEN];
    snprintf(sid, sizeof(sid), "%s", session->session_id);
    nexterm_cp_send_session_closed(cp, sid, "session ended");
    nexterm_sm_finish(&g_session_manager, sid);

    free(args);
    return NULL;
}

int nexterm_ftp_start(nexterm_session_t* session, nexterm_control_plane_t* cp) {
    ftp_thread_args_t* args = calloc(1, sizeof(ftp_thread_args_t));
    if (!args) return -1;

    args->session = session;
    args->cp = cp;

    if (pthread_create(&session->thread, NULL, ftp_session_thread, args) != 0) {
        LOG_ERROR("Failed to create FTP thread for session %s", session->session_id);
        free(args);
        return -1;
    }

    session->thread_active = true;
    pthread_detach(session->thread);
    return 0;
}
