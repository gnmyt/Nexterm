#include "fs.h"
#include "fs_client_relay.h"
#include "rdp.h"

#include <guacamole/client.h>
#include <guacamole/mem.h>
#include <guacamole/protocol.h>
#include <guacamole/socket.h>
#include <guacamole/string.h>
#include <guacamole/user.h>
#include <winpr/file.h>

#include <errno.h>
#include <inttypes.h>
#include <pthread.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#define RELAY_CHUNK_SIZE (1 * 1024 * 1024)

#define RELAY_TIMEOUT_MS 30000
#define RELAY_MAX_DIR_ENTRIES 4096

#define RELAY_READDIR_BATCH 100

static int relay_xlate_status(int s) {
    switch (s) {
        case 0: return 0;
        case 1: return GUAC_RDP_FS_ENOENT;
        case 2: return GUAC_RDP_FS_EACCES;
        case 3: return GUAC_RDP_FS_EEXIST;
        case 4: return GUAC_RDP_FS_EISDIR;
        case 5: return GUAC_RDP_FS_ENOTDIR;
        case 6: return GUAC_RDP_FS_ENOSPC;
        case 7: return GUAC_RDP_FS_EINVAL;
        case 8: return GUAC_RDP_FS_ENOSYS;
        default: return GUAC_RDP_FS_EINVAL;
    }
}

typedef enum relay_req_type {
    REQ_OPEN, REQ_READ, REQ_WRITE, REQ_CLOSE,
    REQ_STAT, REQ_READDIR,
    REQ_UNLINK, REQ_RENAME, REQ_TRUNCATE
} relay_req_type;

typedef struct relay_dir_entry {
    char* name;
    uint64_t size;
    int attributes;
    uint64_t ctime, mtime, atime;
} relay_dir_entry;

typedef struct relay_pending {
    int req_id;
    relay_req_type type;

    pthread_mutex_t mutex;
    pthread_cond_t cond;
    int done;

    int status;
    int int_result;          /* handle (open), bytes (write) */
    uint64_t size, ctime, mtime, atime;
    int attributes;

    /* REQ_READ: caller-owned buffer the stream-blob handler fills. */
    void* read_buffer;
    int read_capacity;
    int read_length;

    /* REQ_READDIR: handler-allocated entry array, ownership passes to
     * relay_read_dir which steals the name pointers. */
    relay_dir_entry* dir_entries;
    int dir_count;

    struct relay_pending* next;
} relay_pending;

typedef struct relay_fs_data {
    pthread_mutex_t lock;
    relay_pending* head;
    int next_req_id;
    /* The non-owner joiner we forward FS ops to. NULL when no client is
     * attached; set/cleared by attach_owner / detach_owner under lock. */
    guac_user* owner;
} relay_fs_data;

typedef struct relay_file_data {
    int remote_handle;
    /* Directory listing cached on first relay_read_dir call. */
    relay_dir_entry* entries;
    int entry_count;
    int entry_index;
} relay_file_data;

static relay_pending* pending_alloc(relay_fs_data* data, relay_req_type type,
        int* out_req_id) {

    relay_pending* p = guac_mem_zalloc(sizeof(*p));
    pthread_mutex_init(&p->mutex, NULL);
    pthread_cond_init(&p->cond, NULL);
    p->type = type;
    p->status = GUAC_RDP_FS_EINVAL;

    pthread_mutex_lock(&data->lock);
    p->req_id = data->next_req_id++;
    p->next = data->head;
    data->head = p;
    pthread_mutex_unlock(&data->lock);

    *out_req_id = p->req_id;
    return p;
}

static void pending_detach(relay_fs_data* data, relay_pending* target) {

    pthread_mutex_lock(&data->lock);
    relay_pending** cur = &data->head;
    while (*cur != NULL) {
        if (*cur == target) {
            *cur = target->next;
            break;
        }
        cur = &((*cur)->next);
    }
    pthread_mutex_unlock(&data->lock);
}

static void pending_free(relay_pending* p) {
    if (p->dir_entries != NULL) {
        for (int i = 0; i < p->dir_count; i++)
            guac_mem_free(p->dir_entries[i].name);
        guac_mem_free(p->dir_entries);
    }
    pthread_mutex_destroy(&p->mutex);
    pthread_cond_destroy(&p->cond);
    guac_mem_free(p);
}

static relay_pending* pending_find_locked(relay_fs_data* data, int req_id) {
    relay_pending* p = data->head;
    while (p != NULL && p->req_id != req_id)
        p = p->next;
    return p;
}

/* Returns a GUAC_RDP_FS_* status, or EINVAL on timeout. */
static int pending_wait(relay_pending* p) {

    struct timespec deadline;
    clock_gettime(CLOCK_REALTIME, &deadline);
    deadline.tv_sec += RELAY_TIMEOUT_MS / 1000;
    deadline.tv_nsec += (RELAY_TIMEOUT_MS % 1000) * 1000000L;
    if (deadline.tv_nsec >= 1000000000L) {
        deadline.tv_sec++;
        deadline.tv_nsec -= 1000000000L;
    }

    int rc = 0;
    pthread_mutex_lock(&p->mutex);
    while (!p->done && rc == 0)
        rc = pthread_cond_timedwait(&p->cond, &p->mutex, &deadline);
    int status = p->done ? p->status : GUAC_RDP_FS_EINVAL;
    pthread_mutex_unlock(&p->mutex);
    return status;
}

static void pending_complete(relay_pending* p, int status) {
    pthread_mutex_lock(&p->mutex);
    p->status = status;
    p->done = 1;
    pthread_cond_signal(&p->cond);
    pthread_mutex_unlock(&p->mutex);
}

static void pending_abort_all(relay_fs_data* data) {
    pthread_mutex_lock(&data->lock);
    relay_pending* p = data->head;
    while (p != NULL) {
        relay_pending* next = p->next;
        pthread_mutex_lock(&p->mutex);
        if (!p->done) {
            p->status = GUAC_RDP_FS_EACCES;
            p->done = 1;
            pthread_cond_signal(&p->cond);
        }
        pthread_mutex_unlock(&p->mutex);
        p = next;
    }
    pthread_mutex_unlock(&data->lock);
}

/* Invoked from the libguac parser thread for each nfs-resp. */
static int relay_handle_resp(guac_user* user, int req_id,
        int status, int argc, char** argv) {

    guac_rdp_client* rdp_client = (guac_rdp_client*) user->client->data;
    if (rdp_client == NULL || rdp_client->filesystem == NULL)
        return 0;

    guac_rdp_fs* fs = rdp_client->filesystem;
    if (fs->backend->type != GUAC_RDP_FS_BACKEND_CLIENT_RELAY)
        return 0;

    relay_fs_data* data = (relay_fs_data*) fs->backend_data;
    if (data == NULL)
        return 0;

    pthread_mutex_lock(&data->lock);

    relay_pending* p = pending_find_locked(data, req_id);
    if (p == NULL) {
        pthread_mutex_unlock(&data->lock);
        guac_user_log(user, GUAC_LOG_DEBUG,
                "nfs-resp for unknown req-id=%d (likely timed out)",
                req_id);
        return 0;
    }

    int xstatus = relay_xlate_status(status);

    if (xstatus != 0) {
        pending_complete(p, xstatus);
        pthread_mutex_unlock(&data->lock);
        return 0;
    }

    switch (p->type) {

        case REQ_OPEN:
            /* handle, size, attrs, ctime, mtime, atime */
            if (argc >= 6) {
                p->int_result = atoi(argv[0]);
                p->size       = (uint64_t) strtoull(argv[1], NULL, 10);
                p->attributes = atoi(argv[2]);
                p->ctime      = (uint64_t) strtoull(argv[3], NULL, 10);
                p->mtime      = (uint64_t) strtoull(argv[4], NULL, 10);
                p->atime      = (uint64_t) strtoull(argv[5], NULL, 10);
            }
            else {
                xstatus = GUAC_RDP_FS_EINVAL;
            }
            break;

        case REQ_READ:
            /* Successful reads complete via the data stream's end_handler;
             * a non-zero status is the only thing arriving here. */
            (void) argv;
            pthread_mutex_unlock(&data->lock);
            return 0;

        case REQ_WRITE:
            p->int_result = (argc >= 1) ? atoi(argv[0]) : 0;
            break;

        case REQ_STAT:
            /* size, attrs, ctime, mtime, atime */
            if (argc >= 5) {
                p->size       = (uint64_t) strtoull(argv[0], NULL, 10);
                p->attributes = atoi(argv[1]);
                p->ctime      = (uint64_t) strtoull(argv[2], NULL, 10);
                p->mtime      = (uint64_t) strtoull(argv[3], NULL, 10);
                p->atime      = (uint64_t) strtoull(argv[4], NULL, 10);
            } else {
                xstatus = GUAC_RDP_FS_EINVAL;
            }
            break;

        case REQ_READDIR: {
            /* count, then count entries each packed as
             * name \x1F size \x1F attrs \x1F ctime \x1F mtime \x1F atime. */
            if (argc < 1) { xstatus = GUAC_RDP_FS_EINVAL; break; }
            int n = atoi(argv[0]);
            if (n < 0) n = 0;
            if (n > RELAY_READDIR_BATCH) n = RELAY_READDIR_BATCH;
            if (argc < 1 + n) { xstatus = GUAC_RDP_FS_EINVAL; break; }
            p->dir_entries = guac_mem_zalloc(sizeof(relay_dir_entry) * (n > 0 ? n : 1));
            p->dir_count = n;
            for (int i = 0; i < n; i++) {
                char* s = argv[1 + i];
                char* fields[6] = { NULL };
                int field = 0;
                fields[field++] = s;
                for (char* c = s; *c && field < 6; c++) {
                    if (*c == 0x1F) { *c = '\0'; fields[field++] = c + 1; }
                }
                if (field < 6) {
                    /* Malformed entry. keep name only, leave the rest 0. */
                    p->dir_entries[i].name = guac_strdup(fields[0] ? fields[0] : "");
                    continue;
                }
                p->dir_entries[i].name = guac_strdup(fields[0]);
                p->dir_entries[i].size = (uint64_t) strtoull(fields[1], NULL, 10);
                p->dir_entries[i].attributes = atoi(fields[2]);
                p->dir_entries[i].ctime = (uint64_t) strtoull(fields[3], NULL, 10);
                p->dir_entries[i].mtime = (uint64_t) strtoull(fields[4], NULL, 10);
                p->dir_entries[i].atime = (uint64_t) strtoull(fields[5], NULL, 10);
            }
            break;
        }

        case REQ_CLOSE:
        case REQ_UNLINK:
        case REQ_RENAME:
        case REQ_TRUNCATE:
            break;
    }

    pending_complete(p, xstatus);
    pthread_mutex_unlock(&data->lock);
    return 0;
}

static int relay_init(guac_rdp_fs* fs, const char* drive_path,
        int create_drive_path) {
    (void) drive_path;
    (void) create_drive_path;

    relay_fs_data* data = guac_mem_zalloc(sizeof(*data));
    pthread_mutex_init(&data->lock, NULL);
    data->next_req_id = 1;
    data->owner = NULL;
    fs->backend_data = data;

    guac_client_log(fs->client, GUAC_LOG_INFO,
            "RDP filesystem using client-relay backend.");
    return 0;
}

static void relay_free(guac_rdp_fs* fs) {
    relay_fs_data* data = (relay_fs_data*) fs->backend_data;
    if (data == NULL) return;

    /* Detach should have aborted everyone first; this is just cleanup. */
    relay_pending* p = data->head;
    while (p != NULL) {
        relay_pending* next = p->next;
        pending_free(p);
        p = next;
    }
    pthread_mutex_destroy(&data->lock);
    guac_mem_free(data);
    fs->backend_data = NULL;
}

/* Win32 access mask → protocol bitmask (0x01 read, 0x02 write, 0x04 append). */
static int flags_to_wire(int access) {
    int f = 0;
    if (access & GENERIC_ALL) f |= 0x03;
    if (access & (GENERIC_READ  | FILE_READ_DATA))  f |= 0x01;
    if (access & (GENERIC_WRITE | FILE_WRITE_DATA)) f |= 0x02;
    if (access & FILE_APPEND_DATA) f |= 0x04;
    if (f == 0) f = 0x01;
    return f;
}

static const char* disposition_to_wire(int create_disposition) {
    switch (create_disposition) {
        case FILE_CREATE:        return "create";
        case FILE_OPEN:          return "open";
        case FILE_OPEN_IF:       return "open-or-create";
        case FILE_OVERWRITE:     return "overwrite";
        case FILE_OVERWRITE_IF:  return "overwrite-or-create";
        case FILE_SUPERSEDE:     return "supersede";
        default:                 return "open";
    }
}

static int relay_open(guac_rdp_fs* fs, guac_rdp_fs_file* file,
        const char* normalized_path, int access, int file_attributes,
        int create_disposition, int create_options) {
    (void) file_attributes;

    relay_fs_data* data = (relay_fs_data*) fs->backend_data;
    if (data == NULL) return GUAC_RDP_FS_EACCES;

    int req_id;
    relay_pending* p = pending_alloc(data, REQ_OPEN, &req_id);

    int is_dir = (create_options & FILE_DIRECTORY_FILE) ? 1 : 0;
    const char* disp_str = disposition_to_wire(create_disposition);

    /* Re-checking owner inside the lock keeps detach_owner from racing
     * the send and freeing the user out from under us. */
    pthread_mutex_lock(&data->lock);
    guac_user* owner = data->owner;
    if (owner != NULL) {
        guac_protocol_send_nfs_open(owner->socket, req_id, normalized_path,
                flags_to_wire(access), disp_str, is_dir);
        guac_socket_flush(owner->socket);
    }
    pthread_mutex_unlock(&data->lock);

    if (owner == NULL) {
        pending_detach(data, p);
        pending_free(p);
        return GUAC_RDP_FS_EACCES;
    }

    int status = pending_wait(p);
    pending_detach(data, p);

    if (status != 0) {
        pending_free(p);
        return status;
    }

    file->size = p->size;
    file->ctime = p->ctime;
    file->mtime = p->mtime;
    file->atime = p->atime;
    file->attributes = p->attributes;

    relay_file_data* fd = guac_mem_zalloc(sizeof(*fd));
    fd->remote_handle = p->int_result;
    file->backend_data = fd;

    pending_free(p);
    return 0;
}

static int relay_read(guac_rdp_fs* fs, guac_rdp_fs_file* file,
        uint64_t offset, void* buffer, int length) {
    relay_fs_data* data = (relay_fs_data*) fs->backend_data;
    relay_file_data* fd = (relay_file_data*) file->backend_data;
    if (data == NULL || fd == NULL) return GUAC_RDP_FS_EACCES;

    int total = 0;
    while (total < length) {
        int chunk = length - total;
        if (chunk > RELAY_CHUNK_SIZE) chunk = RELAY_CHUNK_SIZE;

        int req_id;
        relay_pending* p = pending_alloc(data, REQ_READ, &req_id);
        p->read_buffer = (char*) buffer + total;
        p->read_capacity = chunk;
        p->read_length = 0;

        pthread_mutex_lock(&data->lock);
        guac_user* owner = data->owner;
        if (owner != NULL) {
            guac_protocol_send_nfs_read(owner->socket, req_id,
                    fd->remote_handle, offset + total, chunk);
            guac_socket_flush(owner->socket);
        }
        pthread_mutex_unlock(&data->lock);

        if (owner == NULL) {
            pending_detach(data, p);
            pending_free(p);
            return GUAC_RDP_FS_EACCES;
        }

        /* Success completes via the data stream's end_handler; error
         * completes here via nfs-resp. */
        int status = pending_wait(p);
        pending_detach(data, p);
        int got = p->read_length;
        pending_free(p);

        if (status != 0) return status;
        total += got;
        if (got < chunk) break; /* short read = EOF */
    }
    return total;
}

static int relay_write(guac_rdp_fs* fs, guac_rdp_fs_file* file,
        uint64_t offset, void* buffer, int length) {
    relay_fs_data* data = (relay_fs_data*) fs->backend_data;
    relay_file_data* fd = (relay_file_data*) file->backend_data;
    if (data == NULL || fd == NULL) return GUAC_RDP_FS_EACCES;

    int total = 0;
    while (total < length) {
        int chunk = length - total;
        if (chunk > RELAY_CHUNK_SIZE) chunk = RELAY_CHUNK_SIZE;

        int req_id;
        relay_pending* p = pending_alloc(data, REQ_WRITE, &req_id);

        /* Stream alloc, send and flush all need the owner to still exist;
         * detach takes data->lock, so holding it serialises us against it. */
        pthread_mutex_lock(&data->lock);
        guac_user* owner = data->owner;
        guac_stream* stream = NULL;
        int send_failed_reason = 0; /* 0=ok, 1=no owner, 2=no stream */

        if (owner == NULL) {
            send_failed_reason = 1;
        } else {
            stream = guac_user_alloc_stream(owner);
            if (stream == NULL) {
                send_failed_reason = 2;
            } else {
                guac_protocol_send_nfs_write(owner->socket, req_id,
                        fd->remote_handle, offset + total, chunk,
                        stream->index);
                guac_protocol_send_blobs(owner->socket, stream,
                        (const char*) buffer + total, chunk);
                guac_protocol_send_end(owner->socket, stream);
                guac_socket_flush(owner->socket);
            }
        }
        pthread_mutex_unlock(&data->lock);

        if (send_failed_reason != 0) {
            pending_detach(data, p);
            pending_free(p);
            if (send_failed_reason == 2) {
                guac_client_log(fs->client, GUAC_LOG_WARNING,
                        "relay_write: out of output streams (req_id=%d)",
                        req_id);
                return GUAC_RDP_FS_ENFILE;
            }
            return GUAC_RDP_FS_EACCES;
        }

        int status = pending_wait(p);

        pending_detach(data, p);
        int wrote = p->int_result;
        pending_free(p);

        pthread_mutex_lock(&data->lock);
        if (data->owner == owner)
            guac_user_free_stream(owner, stream);
        pthread_mutex_unlock(&data->lock);

        if (status != 0) return status;
        if (wrote <= 0) break;
        total += wrote;
        if (wrote < chunk) break;
    }
    return total;
}

/* Send-and-wait for ops whose response carries no payload beyond status. */
static int relay_simple_op(guac_rdp_fs* fs, relay_req_type type,
        int remote_handle, const char* path_arg, int int_arg) {
    relay_fs_data* data = (relay_fs_data*) fs->backend_data;
    if (data == NULL) return GUAC_RDP_FS_EACCES;

    int req_id;
    relay_pending* p = pending_alloc(data, type, &req_id);

    pthread_mutex_lock(&data->lock);
    guac_user* owner = data->owner;
    if (owner != NULL) {
        switch (type) {
            case REQ_RENAME:
                guac_protocol_send_nfs_rename(owner->socket, req_id,
                        remote_handle, path_arg);
                break;
            case REQ_UNLINK:
                guac_protocol_send_nfs_unlink(owner->socket, req_id,
                        remote_handle, int_arg);
                break;
            case REQ_TRUNCATE:
                guac_protocol_send_nfs_truncate(owner->socket, req_id,
                        remote_handle, int_arg);
                break;
            case REQ_CLOSE:
                guac_protocol_send_nfs_close(owner->socket, req_id,
                        remote_handle);
                break;
            default:
                break;
        }
        guac_socket_flush(owner->socket);
    }
    pthread_mutex_unlock(&data->lock);

    if (owner == NULL) {
        pending_detach(data, p);
        pending_free(p);
        return GUAC_RDP_FS_EACCES;
    }

    int status = pending_wait(p);
    pending_detach(data, p);
    pending_free(p);
    return status;
}

static int relay_rename(guac_rdp_fs* fs, guac_rdp_fs_file* file,
        const char* new_normalized_path) {
    relay_file_data* fd = (relay_file_data*) file->backend_data;
    if (fd == NULL) return GUAC_RDP_FS_EACCES;
    return relay_simple_op(fs, REQ_RENAME, fd->remote_handle,
            new_normalized_path, 0);
}

static int relay_delete(guac_rdp_fs* fs, guac_rdp_fs_file* file) {
    relay_file_data* fd = (relay_file_data*) file->backend_data;
    if (fd == NULL) return GUAC_RDP_FS_EACCES;
    int is_dir = (file->attributes & FILE_ATTRIBUTE_DIRECTORY) ? 1 : 0;
    return relay_simple_op(fs, REQ_UNLINK, fd->remote_handle, NULL, is_dir);
}

static int relay_truncate(guac_rdp_fs* fs, guac_rdp_fs_file* file,
        int length) {
    relay_file_data* fd = (relay_file_data*) file->backend_data;
    if (fd == NULL) return GUAC_RDP_FS_EACCES;
    return relay_simple_op(fs, REQ_TRUNCATE, fd->remote_handle, NULL, length);
}

static void relay_close(guac_rdp_fs* fs, guac_rdp_fs_file* file) {
    relay_file_data* fd = (relay_file_data*) file->backend_data;
    if (fd == NULL) return;

    relay_simple_op(fs, REQ_CLOSE, fd->remote_handle, NULL, 0);

    if (fd->entries != NULL) {
        for (int i = 0; i < fd->entry_count; i++)
            guac_mem_free(fd->entries[i].name);
        guac_mem_free(fd->entries);
    }
    guac_mem_free(fd);
    file->backend_data = NULL;
}

static const char* relay_read_dir(guac_rdp_fs* fs, guac_rdp_fs_file* file) {
    relay_fs_data* data = (relay_fs_data*) fs->backend_data;
    relay_file_data* fd = (relay_file_data*) file->backend_data;
    if (data == NULL || fd == NULL) return NULL;

    /* First call fetches everything in RELAY_READDIR_BATCH-sized chunks
     * and caches it; subsequent calls just walk the cache. */
    if (fd->entries == NULL) {

        int total = 0;
        int capacity = 0;
        relay_dir_entry* all = NULL;
        int more = 1;

        while (more && total < RELAY_MAX_DIR_ENTRIES) {

            int req_id;
            relay_pending* p = pending_alloc(data, REQ_READDIR, &req_id);

            pthread_mutex_lock(&data->lock);
            guac_user* owner = data->owner;
            if (owner != NULL) {
                guac_protocol_send_nfs_readdir(owner->socket, req_id,
                        fd->remote_handle, total);
                guac_socket_flush(owner->socket);
            }
            pthread_mutex_unlock(&data->lock);

            if (owner == NULL) {
                pending_detach(data, p);
                pending_free(p);
                if (all != NULL) {
                    for (int i = 0; i < total; i++) guac_mem_free(all[i].name);
                    guac_mem_free(all);
                }
                return NULL;
            }

            int status = pending_wait(p);
            pending_detach(data, p);

            if (status != 0) {
                pending_free(p);
                if (all != NULL) {
                    for (int i = 0; i < total; i++) guac_mem_free(all[i].name);
                    guac_mem_free(all);
                }
                return NULL;
            }

            int batch = p->dir_count;
            if (batch > 0) {
                if (total + batch > capacity) {
                    capacity = total + batch;
                    relay_dir_entry* grown =
                        guac_mem_alloc(sizeof(relay_dir_entry) * capacity);
                    if (all != NULL) {
                        memcpy(grown, all, sizeof(relay_dir_entry) * total);
                        guac_mem_free(all);
                    }
                    all = grown;
                }
                memcpy(all + total, p->dir_entries,
                        sizeof(relay_dir_entry) * batch);
                /* Hand off name ownership before pending_free runs. */
                for (int i = 0; i < batch; i++)
                    p->dir_entries[i].name = NULL;
                total += batch;
            }
            more = (batch >= RELAY_READDIR_BATCH);
            pending_free(p);
        }

        fd->entries = all;
        fd->entry_count = total;
        fd->entry_index = 0;
    }

    if (fd->entry_index >= fd->entry_count) return NULL;
    return fd->entries[fd->entry_index++].name;
}

static int relay_get_info(guac_rdp_fs* fs, guac_rdp_fs_info* info) {
    (void) fs;
    info->block_size = 4096;
    info->blocks_total = (16LL * 1024 * 1024 * 1024) / 4096;
    info->blocks_available = info->blocks_total;
    return 0;
}

const guac_rdp_fs_backend guac_rdp_fs_backend_client_relay = {
    .type     = GUAC_RDP_FS_BACKEND_CLIENT_RELAY,
    .init     = relay_init,
    .free_    = relay_free,
    .open     = relay_open,
    .read     = relay_read,
    .write    = relay_write,
    .rename   = relay_rename,
    .delete_  = relay_delete,
    .truncate = relay_truncate,
    .close    = relay_close,
    .read_dir = relay_read_dir,
    .get_info = relay_get_info,
};

void guac_rdp_fs_client_relay_attach_owner(guac_rdp_fs* fs, guac_user* user) {
    if (fs == NULL
            || fs->backend->type != GUAC_RDP_FS_BACKEND_CLIENT_RELAY)
        return;
    relay_fs_data* data = (relay_fs_data*) fs->backend_data;
    if (data == NULL) return;

    pthread_mutex_lock(&data->lock);
    int claimed = (data->owner == NULL);
    if (claimed)
        data->owner = user;
    pthread_mutex_unlock(&data->lock);

    if (!claimed) {
        guac_user_log(user, GUAC_LOG_DEBUG, "Filesystem relay already held by "
                "another user; not serving files from this one.");
        return;
    }

    user->nfs_resp_handler = relay_handle_resp;
    guac_user_log(user, GUAC_LOG_DEBUG, "Serving RDP filesystem from this user.");
}

static relay_fs_data* relay_data_for(guac_user* user) {
    guac_rdp_client* rdp_client = (guac_rdp_client*) user->client->data;
    if (rdp_client == NULL || rdp_client->filesystem == NULL) return NULL;
    if (rdp_client->filesystem->backend->type
            != GUAC_RDP_FS_BACKEND_CLIENT_RELAY) return NULL;
    return (relay_fs_data*) rdp_client->filesystem->backend_data;
}

static int relay_read_stream_blob(guac_user* user, guac_stream* stream,
        void* data_in, int length) {
    relay_fs_data* data = relay_data_for(user);
    if (data == NULL) return 0;
    int req_id = (int)(intptr_t) stream->data;

    /* Lock to keep the RDPDR worker from freeing p mid-copy. */
    pthread_mutex_lock(&data->lock);
    relay_pending* p = pending_find_locked(data, req_id);
    if (p != NULL && p->read_buffer != NULL) {
        int space = p->read_capacity - p->read_length;
        int copy = length < space ? length : space;
        if (copy > 0) {
            memcpy((char*) p->read_buffer + p->read_length, data_in, copy);
            p->read_length += copy;
        }
    }
    pthread_mutex_unlock(&data->lock);
    return 0;
}

static int relay_read_stream_end(guac_user* user, guac_stream* stream) {
    relay_fs_data* data = relay_data_for(user);
    if (data == NULL) return 0;
    int req_id = (int)(intptr_t) stream->data;

    pthread_mutex_lock(&data->lock);
    relay_pending* p = pending_find_locked(data, req_id);
    if (p != NULL)
        pending_complete(p, 0);
    pthread_mutex_unlock(&data->lock);
    return 0;
}

int guac_rdp_fs_client_relay_attach_read_stream(guac_rdp_fs* fs,
        guac_stream* stream, const char* name) {
    if (fs == NULL || stream == NULL || name == NULL) return 0;
    if (fs->backend->type != GUAC_RDP_FS_BACKEND_CLIENT_RELAY) return 0;
    relay_fs_data* data = (relay_fs_data*) fs->backend_data;
    if (data == NULL) return 0;

    int req_id = atoi(name);

    /* Existence check under the lock; the blob/end handlers will re-find. */
    pthread_mutex_lock(&data->lock);
    relay_pending* p = pending_find_locked(data, req_id);
    int valid = (p != NULL && p->type == REQ_READ);
    pthread_mutex_unlock(&data->lock);
    if (!valid)
        return 0;

    stream->data = (void*)(intptr_t) req_id;
    stream->blob_handler = relay_read_stream_blob;
    stream->end_handler  = relay_read_stream_end;
    return 0;
}

void guac_rdp_fs_client_relay_detach_owner(guac_rdp_fs* fs, guac_user* user) {
    if (fs == NULL
            || fs->backend->type != GUAC_RDP_FS_BACKEND_CLIENT_RELAY)
        return;
    relay_fs_data* data = (relay_fs_data*) fs->backend_data;
    if (data == NULL) return;
    pthread_mutex_lock(&data->lock);
    int was_owner = (data->owner == user);
    if (was_owner)
        data->owner = NULL;
    pthread_mutex_unlock(&data->lock);

    if (!was_owner)
        return;

    user->nfs_resp_handler = NULL;
    pending_abort_all(data);
}
