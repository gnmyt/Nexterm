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

const SHARED_DRIVE_KEY = "nexterm.sharedDrive";
const SHARED_DRIVE_MODES = ["folder", "disk", "off"];

export const getSharedDrive = () => {
    try {
        const stored = JSON.parse(localStorage.getItem(SHARED_DRIVE_KEY));
        if (stored && SHARED_DRIVE_MODES.includes(stored.mode)) return { mode: stored.mode, folder: stored.folder || null };
    } catch {}
    return { mode: "folder", folder: null };
};

export const saveSharedDrive = (setting) => {
    try { localStorage.setItem(SHARED_DRIVE_KEY, JSON.stringify(setting)); } catch {}
};

export const configureSharedDrive = ({ mode, folder }) =>
    invoke("host_fs_configure", { mode, folder: mode === "folder" ? folder : null });

export const describeSharedFolder = async (folder) => {
    const info = await configureSharedDrive({ mode: "folder", folder });
    invoke("host_fs_release", { share: info.share }).catch(() => {});
    return info.folder;
};

export const createHostFsProvider = () => {
    if (!isTauri()) return null;

    const setting = getSharedDrive();
    if (setting.mode === "off") return null;

    const ready = configureSharedDrive(setting);
    const call = (cmd, args) => ready.then(({ share }) => invoke(cmd, { ...args, share }));

    return {
        open: (path, flags, disposition, isDirectory) =>
            call("host_fs_open", { path, flags, disposition, isDirectory })
                .then(r => ({
                    handle: r.handle, size: r.size, attributes: r.attributes,
                    ctime: r.ctime, mtime: r.mtime, atime: r.atime
                })),

        read: (handle, offset, length) =>
            call("host_fs_read", { handle, offset, length })
                .then(r => ({ data: base64ToBytes(r.data || "").buffer })),

        write: (handle, offset, dataBuffer) => {
            const bytes = dataBuffer instanceof Uint8Array
                    ? dataBuffer : new Uint8Array(dataBuffer);
            return call("host_fs_write", {
                handle, offset, data: bytesToBase64(bytes),
            }).then(r => ({ bytesWritten: r.bytes_written }));
        },

        close: (handle) => call("host_fs_close", { handle }),

        stat: (path) => call("host_fs_stat", { path }),

        readdir: (handle, offset, limit) =>
            call("host_fs_readdir", { handle, offset, limit }),

        unlink: (handle, isDirectory) =>
            call("host_fs_unlink", { handle, isDirectory }),

        rename: (handle, newPath) =>
            call("host_fs_rename", { handle, newPath }),

        truncate: (handle, length) =>
            call("host_fs_truncate", { handle, length }),
    };
};
