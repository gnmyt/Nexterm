const isPlainObject = (value) =>
    value !== null && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);

const normalizeForCompare = (value) => {
    if (value === undefined || value === null || value === "") return undefined;
    if (Array.isArray(value)) return value.map(normalizeForCompare);
    if (value instanceof Date) return value.toISOString();
    if (isPlainObject(value)) {
        const result = {};
        for (const key of Object.keys(value).sort()) {
            const normalized = normalizeForCompare(value[key]);
            if (normalized !== undefined) result[key] = normalized;
        }
        return result;
    }
    return value;
};

export const serializeForCompare = (value) => JSON.stringify(normalizeForCompare(value)) ?? "";
