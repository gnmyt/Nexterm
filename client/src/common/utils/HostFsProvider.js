import { isTauri } from "@/common/utils/TauriUtil.js";
import { FsError, E_IO } from "@/common/utils/FsError.js";
import { bytesToBase64, base64ToBytes } from "@/common/utils/base64.js";

const invoke = async (cmd, args) => {
    const { invoke } = await import("@tauri-apps/api/core");
    try {
        return await invoke(cmd, args);
    } catch (err) {
        if (err && typeof err === "object" && typeof err.code === "number")
            throw new FsError(err.code, err.message);
        throw new FsError(E_IO, String(err));
    }
};

export const createHostFsProvider = () => {
    if (!isTauri()) return null;

    return {
        open: (path, flags, disposition, isDirectory) =>
            invoke("host_fs_open", { path, flags, disposition, isDirectory })
                .then(r => ({
                    handle: r.handle, size: r.size, attributes: r.attributes,
                    ctime: r.ctime, mtime: r.mtime, atime: r.atime
                })),

        read: (handle, offset, length) =>
            invoke("host_fs_read", { handle, offset, length })
                .then(r => ({ data: base64ToBytes(r.data || "").buffer })),

        write: (handle, offset, dataBuffer) => {
            const bytes = dataBuffer instanceof Uint8Array
                    ? dataBuffer : new Uint8Array(dataBuffer);
            return invoke("host_fs_write", {
                handle, offset, data: bytesToBase64(bytes),
            }).then(r => ({ bytesWritten: r.bytes_written }));
        },

        close: (handle) => invoke("host_fs_close", { handle }),

        stat: (path) => invoke("host_fs_stat", { path }),

        readdir: (handle, offset, limit) =>
            invoke("host_fs_readdir", { handle, offset, limit }),

        unlink: (handle, isDirectory) =>
            invoke("host_fs_unlink", { handle, isDirectory }),

        rename: (handle, newPath) =>
            invoke("host_fs_rename", { handle, newPath }),

        truncate: (handle, length) =>
            invoke("host_fs_truncate", { handle, length }),
    };
};
