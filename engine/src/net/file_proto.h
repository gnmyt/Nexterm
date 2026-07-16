#ifndef NEXTERM_FILE_PROTO_H
#define NEXTERM_FILE_PROTO_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#define FP_CHUNK_SIZE  1048576
#define FP_MAX_PATH    4096
#define FP_MAX_FRAME   (16 * 1024 * 1024)
#define FP_SEARCH_MAX  20
#define FP_THUMB_MAX_BYTES (12 * 1024 * 1024)

typedef struct {
    char* name;
    bool is_dir;
    bool is_symlink;
    uint64_t size;
    uint32_t mtime;
    uint32_t mode;
} fp_entry_t;

typedef struct {
    fp_entry_t* items;
    size_t count;
    size_t cap;
} fp_entries_t;

typedef struct {
    uint64_t size;
    uint32_t mode;
    uint32_t uid;
    uint32_t gid;
    uint32_t atime;
    uint32_t mtime;
    char owner[128];
    char group[128];
    bool is_dir;
} fp_stat_t;

typedef struct {
    char paths[FP_SEARCH_MAX][FP_MAX_PATH];
    int count;
    int max_results;
    int64_t deadline;
    bool timed_out;
} fp_search_t;

int fp_entries_push(fp_entries_t* list, const char* name, bool is_dir,
                    bool is_symlink, uint64_t size, uint32_t mtime, uint32_t mode);
void fp_entries_free(fp_entries_t* list);

int fp_send_ready(int fd);
int fp_send_ok(int fd, uint32_t rid);
int fp_send_error(int fd, uint32_t rid, const char* message, int32_t code);
int fp_send_file_data(int fd, uint32_t rid, const uint8_t* data, size_t len,
                      uint64_t total_size);
int fp_send_file_end(int fd, uint32_t rid);
int fp_send_thumbnail(int fd, uint32_t rid, const uint8_t* data, size_t len,
                      uint32_t w, uint32_t h);
int fp_send_dir_list(int fd, uint32_t rid, const fp_entries_t* list);
int fp_send_stat(int fd, uint32_t rid, const fp_stat_t* st);
int fp_send_realpath(int fd, uint32_t rid, const char* path, bool is_dir);
int fp_send_exec_result(int fd, uint32_t rid, const char* stdout_data,
                        const char* stderr_data, int32_t exit_code);
int fp_send_search_result(int fd, uint32_t rid, const fp_search_t* ctx);

int64_t fp_monotonic_ms(void);
bool fp_name_matches(const char* name, const char* search_term);
void fp_parse_search_path(const char* search_path, char* base_path, size_t base_sz,
                          char* search_term, size_t term_sz, bool* inside);
void fp_join_path(const char* base, const char* name, char* out, size_t out_sz);

#endif
