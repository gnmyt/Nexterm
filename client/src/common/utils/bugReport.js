import { isTauri } from "@/common/utils/TauriUtil.js";

const BROWSERS = [
    ["Edge", /Edg(?:e|A|iOS)?\/(\d+)/],
    ["Opera", /OPR\/(\d+)/],
    ["Firefox", /(?:Firefox|FxiOS)\/(\d+)/],
    ["Chrome", /(?:Chrome|CriOS)\/(\d+)/],
    ["Safari", /Version\/(\d+).*Safari/],
];

const SYSTEMS = [
    ["Windows", /Windows/],
    ["Android", /Android/],
    ["iOS", /iPhone|iPad|iPod/],
    ["macOS", /Mac OS X|Macintosh/],
    ["Linux", /Linux/],
];

const describeBrowser = (ua) => {
    for (const [name, pattern] of BROWSERS) {
        const match = pattern.exec(ua);
        if (match) return `${name} ${match[1]}`;
    }
    return null;
};

const describeSystem = (ua) => SYSTEMS.find(([, pattern]) => pattern.test(ua))?.[0] ?? null;

const describeEnvironment = (ua) => {
    const client = isTauri() ? "Connector app" : describeBrowser(ua);
    const system = describeSystem(ua);
    if (client && system) return `${client} on ${system}`;
    return client ?? system;
};

const describeDevice = (ua) => {
    if (isTauri()) return "On the connector app";
    if (/iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) return "On a tablet";
    if (/iPhone|iPod|Android|Mobile/.test(ua)) return "On mobile";
    return "In the browser";
};

export const buildBugReportUrl = (githubUrl, version, ua = navigator.userAgent) => {
    const params = new URLSearchParams({ template: "bug_report.yml", browsers: describeDevice(ua) });
    if (version) params.set("version", `v${version}`);

    const environment = describeEnvironment(ua);
    if (environment) params.set("environment", environment);

    return `${githubUrl}/issues/new?${params}`;
};
