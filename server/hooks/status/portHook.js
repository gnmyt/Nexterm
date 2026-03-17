const net = require("net");
const logger = require("../../utils/logger");

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
            logger.warn(`Entry missing IP or port configuration`, { entryId: entry.id, name: entry.name });
            return "offline";
        }

        const isOpen = await isRemotePortOpen(ip, port, 2000);
        return isOpen ? "online" : "offline";
    } catch (error) {
        logger.error(`Error checking server status`, { entryId: entry.id, error: error.message });
        return "offline";
    }
}

module.exports = { checkServerStatus };