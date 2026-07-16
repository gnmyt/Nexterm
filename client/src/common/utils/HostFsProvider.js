import { isTauri } from "@/common/utils/TauriUtil.js";

const bytesToBase64 = (bytes) => {
    const CHUNK = 32768;
    const parts = [];
    for (let i = 0; i < bytes.length; i += CHUNK) {
        parts.push(String.fromCharCode.apply(
                null, bytes.subarray(i, Math.min(i + CHUNK, bytes.length))));
    }
    return btoa(parts.join(""));
};

const base64ToBytes = (b64) => {
    const binary = atob(b64);
    return Uint8Array.from(binary, c => c.charCodeAt(0));
};

const invoke = async (cmd, args) => {
    const { invoke } = await import("@tauri-apps/api/core");
    try {
        return await invoke(cmd, args);
    } catch (err) {
        if (err && typeof err === "object" && typeof err.code === "number")
            throw err;
        throw { code: 9, message: String(err) };
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
