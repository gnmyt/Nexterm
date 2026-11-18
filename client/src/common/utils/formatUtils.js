const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB", "PB"];

export const formatBytes = (bytes) => {
    if (!bytes) return "0 B";
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), BYTE_UNITS.length - 1);
    return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${BYTE_UNITS[i]}`;
};

export const formatDate = (date) => new Date(date).toLocaleString();
