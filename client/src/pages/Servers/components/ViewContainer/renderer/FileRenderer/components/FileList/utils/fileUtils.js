import {
    mdiArchive, mdiFile, mdiFileDocument, mdiImage, mdiMovie, mdiMusicNote,
} from "@mdi/js";

export const THUMBNAIL_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "bmp"];

export const PREVIEWABLE_EXTENSIONS = [
    "jpg", "jpeg", "png", "gif", "bmp", "webp", "svg",
    "mp4", "webm", "ogg", "mov", "mp3", "wav", "flac", "m4a", "pdf",
];

export const FILE_ICONS = {
    jpg: mdiImage, jpeg: mdiImage, png: mdiImage, gif: mdiImage, bmp: mdiImage, webp: mdiImage, svg: mdiImage,
    mp3: mdiMusicNote, wav: mdiMusicNote, flac: mdiMusicNote, ogg: mdiMusicNote, m4a: mdiMusicNote,
    mp4: mdiMovie, avi: mdiMovie, mov: mdiMovie, mkv: mdiMovie, webm: mdiMovie,
    txt: mdiFileDocument, log: mdiFileDocument, md: mdiFileDocument, json: mdiFileDocument, xml: mdiFileDocument,
    zip: mdiArchive, rar: mdiArchive, "7z": mdiArchive, tar: mdiArchive, gz: mdiArchive,
};

export const FILE_COLORS = {
    jpg: "#ff6b6b", jpeg: "#ff6b6b", png: "#ff6b6b", gif: "#ff6b6b", bmp: "#ff6b6b", webp: "#ff6b6b", svg: "#ff6b6b",
    mp3: "#51cf66", wav: "#51cf66", flac: "#51cf66", ogg: "#51cf66", m4a: "#51cf66",
    mp4: "#ffa500", avi: "#ffa500", mov: "#ffa500", mkv: "#ffa500", webm: "#ffa500",
    txt: "#74c0fc", log: "#74c0fc", md: "#74c0fc", json: "#74c0fc", xml: "#74c0fc",
    zip: "#ffd43b", rar: "#ffd43b", "7z": "#ffd43b", tar: "#ffd43b", gz: "#ffd43b",
};

export const OPERATIONS = {
    READY: 0x0, LIST_FILES: 0x1, CREATE_FILE: 0x4, CREATE_FOLDER: 0x5, DELETE_FILE: 0x6,
    DELETE_FOLDER: 0x7, RENAME_FILE: 0x8, ERROR: 0x9, SEARCH_DIRECTORIES: 0xA,
    RESOLVE_SYMLINK: 0xB, MOVE_FILES: 0xC, COPY_FILES: 0xD, CHMOD: 0xE,
};

export const getExtension = (filename) => filename.split(".").pop()?.toLowerCase();

export const isThumbnailSupported = (filename) => THUMBNAIL_EXTENSIONS.includes(getExtension(filename));

export const isPreviewable = (filename) => PREVIEWABLE_EXTENSIONS.includes(getExtension(filename));

export const getIconByFileEnding = (ending) => FILE_ICONS[ending] || mdiFile;

export const getIconColor = (item) => item.type === "folder" ? "" : (FILE_COLORS[getExtension(item.name)] || "#adb5bd");

export const convertUnits = (bytes) => {
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    if (bytes === 0) return "0 Byte";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i)) + " " + sizes[i];
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
