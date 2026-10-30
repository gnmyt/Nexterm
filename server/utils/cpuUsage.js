const STAT_FIELDS_WITHOUT_GUEST = 8;

const parseCPUStatLine = (line) => {
    const vals = line.trim().split(/\s+/).slice(1, STAT_FIELDS_WITHOUT_GUEST + 1).map(Number);
    if (vals.length < 4 || vals.some(v => !Number.isFinite(v))) return null;
    const [, , , idle, iowait = 0] = vals;
    return { total: vals.reduce((a, b) => a + b, 0), idle: idle + iowait };
};

const parseCPUUsage = (output) => {
    try {
        const samples = String(output ?? "")
            .split("\n")
            .filter(line => line.trim().startsWith("cpu "))
            .map(parseCPUStatLine)
            .filter(Boolean);
        if (samples.length < 2) return null;

        const first = samples[0];
        const last = samples[samples.length - 1];
        const total = last.total - first.total;
        const idle = last.idle - first.idle;
        if (total <= 0) return null;

        return Math.min(100, Math.max(0, Math.round(((total - idle) / total) * 100)));
    } catch {
        return null;
    }
};

module.exports = { parseCPUUsage };
