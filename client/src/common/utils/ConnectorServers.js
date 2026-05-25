const SERVERS_KEY = "nexterm_servers";
const ACTIVE_KEY = "nexterm_active_server";

export const getServers = () => {
    try {
        return JSON.parse(localStorage.getItem(SERVERS_KEY) || "[]");
    } catch {
        return [];
    }
};

const saveServers = (servers) =>
    localStorage.setItem(SERVERS_KEY, JSON.stringify(servers));

export const getActiveServerId = () => localStorage.getItem(ACTIVE_KEY);

export const getActiveServer = () => {
    const id = getActiveServerId();
    return getServers().find(s => s.id === id) || null;
};

export const addServer = (url, token) => {
    const servers = getServers();
    const id = crypto.randomUUID();
    const cleanUrl = url.replace(/\/$/, "");
    servers.push({ id, url: cleanUrl, token });
    saveServers(servers);
    return id;
};

export const removeServer = (id) => {
    const servers = getServers().filter(s => s.id !== id);
    saveServers(servers);
    return servers;
};

export const updateServerToken = (id, token) => {
    const servers = getServers();
    const server = servers.find(s => s.id === id);
    if (server) {
        server.token = token;
        saveServers(servers);
    }
};

export const activateServer = (id) => {
    const server = getServers().find(s => s.id === id);
    if (!server) return false;
    localStorage.setItem(ACTIVE_KEY, id);
    localStorage.setItem("nexterm_server_url", server.url);
    localStorage.setItem("sessionToken", server.token);
    localStorage.removeItem("overrideToken");
    return true;
};

export const switchServer = (id) => {
    if (activateServer(id)) window.location.reload();
};

export const getServerDisplayName = (server) => {
    try {
        const { hostname } = new URL(server.url);
        return hostname;
    } catch {
        return server.url;
    }
};
