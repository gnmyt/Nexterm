const path = require("node:path");

const DEMO_SETTINGS = Object.freeze({
    guestTtlMinutes: 120,
    maxGuests: 200,
    guestsPerIpPerHour: 5,
    maxSessionsPerGuest: 5,
    configPath: path.join("data", "demo.json"),
});

const isDemoMode = () => process.env.DEMO_MODE === "true";

const isDemoGuest = (account) => !!account?.demoExpiresAt;

const isGuestExpired = (account) =>
    isDemoGuest(account) && (!isDemoMode() || new Date(account.demoExpiresAt).getTime() <= Date.now());

const ANY = "*";
const WRITE = "write";

const GUEST_BLOCKED_ROUTES = [
    [ANY, /^\/api\/accounts\/password$/],
    [ANY, /^\/api\/accounts\/totp\//],
    [ANY, /^\/api\/accounts\/search$/],
    [ANY, /^\/api\/accounts\/me\/avatar$/, "POST"],
    [WRITE, /^\/api\/accounts\/passkeys(\/|$)/],
    [WRITE, /^\/api\/accounts\/api-keys(\/|$)/],
    [ANY, /^\/api\/mcp(\/|$)/],
    [ANY, /^\/api\/organizations\/\d+\/members(\/|$)/],
    [ANY, /^\/api\/organizations\/\d+\/invite$/],
    [WRITE, /^\/api\/ai(\/|$)/],
];

const matchesMethod = (rule, method, explicitMethod) => {
    if (explicitMethod) return explicitMethod === method;
    if (rule === WRITE) return !["GET", "HEAD", "OPTIONS"].includes(method);
    return true;
};

const isBlockedForGuest = (method, url) => {
    const pathname = String(url || "").split("?")[0].replace(/\/+$/, "") || "/";

    return GUEST_BLOCKED_ROUTES.some(([rule, pattern, explicitMethod]) =>
        pattern.test(pathname) && matchesMethod(rule, method.toUpperCase(), explicitMethod));
};

module.exports = { DEMO_SETTINGS, isDemoMode, isDemoGuest, isGuestExpired, isBlockedForGuest };
