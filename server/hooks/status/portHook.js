const net = require("net");

const isRemotePortOpen = (host, port, timeout = 1500) => {
    return new Promise((resolve) => {
        const socket = new net.Socket();

        const onError = () => {
            socket.destroy();
            resolve(false);
        };

        socket.setTimeout(timeout);
        socket.once("timeout", onError);
        socket.once("error", onError);

        socket.connect(port, host, () => {
            socket.end();
            resolve(true);
        });
    });
}

const checkServerStatus = async (entry) => {
    try {
        const { ip, port } = entry.config || {};
        
        if (!ip || !port) {
            console.warn(`Entry ${entry.id} (${entry.name}) missing IP or port configuration`);
            return "offline";
        }

        const isOpen = await isRemotePortOpen(ip, port, 2000);
        return isOpen ? "online" : "offline";
    } catch (error) {
        console.error(`Error checking server status for entry ${entry.id}:`, error.message);
        return "offline";
    }
}

module.exports = { checkServerStatus };