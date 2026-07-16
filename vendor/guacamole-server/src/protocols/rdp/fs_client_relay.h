#ifndef GUAC_RDP_FS_CLIENT_RELAY_H
#define GUAC_RDP_FS_CLIENT_RELAY_H

#include "fs.h"
#include <guacamole/user.h>
#include <guacamole/stream-types.h>

/**
 * Route relay-backed FS ops through this user and install the nfs-resp
 * handler. No-op on non-relay backends.
 */
void guac_rdp_fs_client_relay_attach_owner(guac_rdp_fs* fs, guac_user* user);

/**
 * Stop routing through `user` and abort any in-flight requests with
 * GUAC_RDP_FS_EACCES so blocked RDPDR workers unwind.
 */
void guac_rdp_fs_client_relay_detach_owner(guac_rdp_fs* fs, guac_user* user);

/**
 * Attach a "file"-stream (mimetype application/x-nexterm-fs, name = req-id)
 * to the matching in-flight read so its blobs land in the read buffer.
 */
int guac_rdp_fs_client_relay_attach_read_stream(guac_rdp_fs* fs,
        guac_stream* stream, const char* name);

#endif
