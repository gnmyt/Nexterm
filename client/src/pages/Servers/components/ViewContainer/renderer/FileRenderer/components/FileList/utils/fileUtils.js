export const THUMBNAIL_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "bmp"];

export const PREVIEWABLE_EXTENSIONS = [
    "jpg", "jpeg", "png", "gif", "bmp", "webp", "svg",
    "mp4", "webm", "ogg", "mov", "mp3", "wav", "flac", "m4a", "pdf",
];

export const OPERATIONS = {
    READY: 0x0, LIST_FILES: 0x1, CREATE_FILE: 0x4, CREATE_FOLDER: 0x5, DELETE_FILE: 0x6,
    DELETE_FOLDER: 0x7, RENAME_FILE: 0x8, ERROR: 0x9, SEARCH_DIRECTORIES: 0xA,
    RESOLVE_SYMLINK: 0xB, MOVE_FILES: 0xC, COPY_FILES: 0xD, CHMOD: 0xE,
    STAT: 0xF, CHECKSUM: 0x10, FOLDER_SIZE: 0x11,
};

export const getExtension = (filename) => filename.split(".").pop()?.toLowerCase();

export const isThumbnailSupported = (filename) => THUMBNAIL_EXTENSIONS.includes(getExtension(filename));

export const isPreviewable = (filename) => PREVIEWABLE_EXTENSIONS.includes(getExtension(filename));

export const convertUnits = (bytes) => {
    if (!bytes) return "0 B";
    const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
    const value = bytes / Math.pow(1024, i);
    const rounded = i === 0 || value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
    return `${rounded.toLocaleString()} ${sizes[i]}`;
};

const SIX_MONTHS_SECONDS = 182 * 24 * 60 * 60;

export const formatModified = (unixSeconds) => {
    const date = new Date(unixSeconds * 1000);
    const isRecent = Date.now() / 1000 - unixSeconds < SIX_MONTHS_SECONDS;
    return isRecent
        ? date.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
        : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

export const getFullPath = (path, name) => `${path.endsWith("/") ? path : path + "/"}${name}`;

export const parsePermissions = (mode) => {
    if (typeof mode !== 'number') return { owner: { r: false, w: false, x: false }, group: { r: false, w: false, x: false }, others: { r: false, w: false, x: false } };
    return {
        owner: { r: !!(mode & 0o400), w: !!(mode & 0o200), x: !!(mode & 0o100) },
        group: { r: !!(mode & 0o040), w: !!(mode & 0o020), x: !!(mode & 0o010) },
        others: { r: !!(mode & 0o004), w: !!(mode & 0o002), x: !!(mode & 0o001) },
    };
};

export const permissionsToMode = (perms) => {
    let mode = 0;
    if (perms.owner.r) mode |= 0o400;
    if (perms.owner.w) mode |= 0o200;
    if (perms.owner.x) mode |= 0o100;
    if (perms.group.r) mode |= 0o040;
    if (perms.group.w) mode |= 0o020;
    if (perms.group.x) mode |= 0o010;
    if (perms.others.r) mode |= 0o004;
    if (perms.others.w) mode |= 0o002;
    if (perms.others.x) mode |= 0o001;
    return mode;
};

export const formatPermissionsString = (mode) => {
    if (typeof mode !== 'number') return '---------';
    const perms = parsePermissions(mode);
    const format = (p) => (p.r ? 'r' : '-') + (p.w ? 'w' : '-') + (p.x ? 'x' : '-');
    return format(perms.owner) + format(perms.group) + format(perms.others);
};

export const formatOctal = (mode) => {
    if (typeof mode !== 'number') return '000';
    return (mode & 0o777).toString(8).padStart(3, '0');
};
