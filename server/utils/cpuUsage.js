const parseCPUStatLine = (line) => {
    const vals = line.trim().split(/\s+/).slice(1).map(Number);
    if (vals.length < 4 || vals.some(v => !Number.isFinite(v))) return null;
    return { total: vals.reduce((a, b) => a + b, 0), idle: vals[3] };
};

// Expects two (or more) aggregate "cpu ..." lines from /proc/stat taken a short time apart.
// The counters are cumulative since boot, so only the difference between two samples
// reflects the current usage. A single sample cannot be turned into a percentage.
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
