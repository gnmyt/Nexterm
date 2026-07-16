import { FsError, E_NOENT, E_ACCES, E_EXIST, E_INVAL, E_NOSYS, E_IO } from "@/common/utils/FsError.js";

const ATTR_DIRECTORY = 0x0010;
const ATTR_NORMAL    = 0x0080;

const stripLeading = (p) => (p || "").replace(/^[\\/]+/, "");
const isRoot = (p) => stripLeading(p) === "";

const opfsAvailable = () =>
        typeof navigator !== "undefined"
        && !!navigator.storage
        && typeof navigator.storage.getDirectory === "function";

export const createBrowserFsProvider = () => {

    const files = new Map();

    let opfsScopePromise = null;
    const ensureOpfsScope = () => {
        if (opfsScopePromise) return opfsScopePromise;
        if (!opfsAvailable())
            return Promise.reject(
                    new FsError(E_NOSYS, "OPFS not available in this browser"));
        opfsScopePromise = navigator.storage.getDirectory()
                .then(root => root.getDirectoryHandle(
                        `nexterm-rdp-${Date.now()}`, { create: true }));
        return opfsScopePromise;
    };

    const opfsFiles = new Map();

    const handles = new Map();
    let nextHandle = 1;

    const fileToEntry = (name, file) => ({
        name,
        size: file.size,
        attributes: ATTR_NORMAL,
        ctime: file.lastModified || 0,
        mtime: file.lastModified || 0,
        atime: file.lastModified || 0,
    });

    const rootEntry = () => ({
        name: "",
        size: 0,
        attributes: ATTR_DIRECTORY,
        ctime: 0, mtime: 0, atime: 0,
    });

    return {

        open: (path, flags, disposition, isDirectory) => {
            if (isRoot(path)) {
                if (disposition === "create")
                    return Promise.reject(new FsError(E_EXIST, "root exists"));
                const h = nextHandle++;
                handles.set(h, { kind: "dir" });
                return Promise.resolve({
                    handle: h, size: 0, attributes: ATTR_DIRECTORY,
                    ctime: 0, mtime: 0, atime: 0,
                });
            }

            const name = stripLeading(path);
            const existing = files.get(name);

            if (isDirectory) {
                return Promise.reject(
                        new FsError(E_NOSYS, "nested directories not supported"));
            }

            if (!existing) {
                if (disposition === "open" || disposition === "overwrite")
                    return Promise.reject(new FsError(E_NOENT, name));
                if (disposition === "create" || disposition === "open-or-create"
                        || disposition === "overwrite-or-create"
                        || disposition === "supersede") {
                    return ensureOpfsScope()
                        .then(scope => scope.getFileHandle(name, { create: true }))
                        .then(fileHandle => fileHandle.createWritable({
                            keepExistingData: disposition === "open-or-create",
                        }).then(writable => {
                            const h = nextHandle++;
                            handles.set(h, {
                                kind: "opfs-write",
                                fileHandle, writable, name, dirty: false,
                                size: 0,
                            });
                            opfsFiles.set(name, fileHandle);
                            const now = Date.now();
                            return {
                                handle: h, size: 0, attributes: ATTR_NORMAL,
                                ctime: now, mtime: now, atime: now,
                            };
                        }));
                }
                return Promise.reject(new FsError(E_INVAL, disposition));
            }

            if (disposition === "create")
                return Promise.reject(new FsError(E_EXIST, name));

            const h = nextHandle++;
            handles.set(h, { kind: "file", file: existing, name });
            const meta = fileToEntry(name, existing);
            return Promise.resolve({
                handle: h, size: meta.size, attributes: meta.attributes,
                ctime: meta.ctime, mtime: meta.mtime, atime: meta.atime,
            });
        },

        read: async (handle, offset, length) => {
            const h = handles.get(handle);
            if (h?.kind !== "file")
                return { data: new ArrayBuffer(0) };
            const slice = h.file.slice(offset, offset + length);
            const buf = await slice.arrayBuffer();
            return { data: buf };
        },

        write: async (handle, offset, dataBuffer) => {
            const h = handles.get(handle);
            if (h?.kind !== "opfs-write")
                throw new FsError(E_ACCES, "not writable");
            const bytes = dataBuffer instanceof Uint8Array
                    ? dataBuffer : new Uint8Array(dataBuffer);
            await h.writable.write({
                type: "write", position: offset, data: bytes,
            });
            h.dirty = true;
            if (offset + bytes.length > h.size) h.size = offset + bytes.length;
            return { bytesWritten: bytes.length };
        },

        close: async (handle) => {
            const h = handles.get(handle);
            handles.delete(handle);
            if (h?.kind !== "opfs-write") return;
            try { await h.writable.close(); } catch { /* ignored */ }
            if (!h.dirty) return;

            try {
                const file = await h.fileHandle.getFile();
                const url = URL.createObjectURL(file);
                const a = document.createElement("a");
                a.href = url;
                a.download = h.name;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            } catch (err) {
                console.error("Failed to download OPFS file:", err);
            }
        },

        stat: async (path) => {
            if (isRoot(path)) return rootEntry();
            const name = stripLeading(path);
            const f = files.get(name);
            if (f) return fileToEntry(name, f);
            const opfsHandle = opfsFiles.get(name);
            if (opfsHandle) {
                try {
                    return fileToEntry(name, await opfsHandle.getFile());
                } catch { /* fall through to ENOENT */ }
            }
            throw new FsError(E_NOENT, name);
        },

        readdir: async (handle, offset, limit) => {
            const h = handles.get(handle);
            if (h?.kind !== "dir") return [];
            const entries = [];
            for (const [name, file] of files)
                entries.push(fileToEntry(name, file));
            for (const [name, fileHandle] of opfsFiles) {
                if (files.has(name)) continue;
                try {
                    entries.push(fileToEntry(name, await fileHandle.getFile()));
                } catch { /* entry vanished mid-listing. skip it */ }
            }
            const start = Math.min(offset || 0, entries.length);
            const end = limit != null
                    ? Math.min(start + limit, entries.length)
                    : entries.length;
            return entries.slice(start, end);
        },

        unlink: (handle) => {
            const h = handles.get(handle);
            handles.delete(handle);
            if (!h) return Promise.resolve();
            if (h.kind === "file" && h.name) {
                files.delete(h.name);
                return Promise.resolve();
            }
            if (h.kind === "opfs-write" && h.name) {
                opfsFiles.delete(h.name);
                ensureOpfsScope().then(scope => scope.removeEntry(h.name))
                        .catch(() => {});
            }
            return Promise.resolve();
        },

        rename: (handle, newPath) => {
            const h = handles.get(handle);
            if (!h) return Promise.reject(new FsError(E_NOENT, "bad handle"));
            const newName = stripLeading(newPath);
            if (h.kind === "file" && h.name) {
                const f = files.get(h.name);
                if (!f) return Promise.reject(new FsError(E_NOENT, h.name));
                files.delete(h.name);
                files.set(newName, f);
                h.name = newName;
                return Promise.resolve();
            }
            if (h.kind === "opfs-write" && h.name) {
                const oldName = h.name;
                h.name = newName;
                opfsFiles.delete(oldName);
                opfsFiles.set(newName, h.fileHandle);
                return Promise.resolve();
            }
            return Promise.reject(
                    new FsError(E_NOSYS, "rename unsupported on this handle"));
        },

        truncate: async (handle, length) => {
            const h = handles.get(handle);
            if (h?.kind !== "opfs-write")
                throw new FsError(E_NOSYS, "truncate requires writable handle");
            try {
                await h.writable.truncate(Math.max(0, length));
                h.size = Math.max(0, length);
            } catch (err) {
                throw new FsError(E_IO, String(err));
            }
        },

        addFiles: (fileList) => {
            const added = [];
            for (const file of fileList) {
                files.set(file.name, file);
                added.push(file.name);
            }
            return added;
        },
    };
};
