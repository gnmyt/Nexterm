const axios = require("axios");
const https = require("https");
const { Agent } = require("https");

module.exports.createTicket = async (server = { ip: "", port: 0 }, username, password) => {
    const data = await axios.post(`https://${server.ip}:${server.port}/api2/json/access/ticket`, {
        username: username,
        password: password,
    }, {
        timeout: 3000,
        httpsAgent: new Agent({ rejectUnauthorized: false }),
    });

    return data.data.data;
};

module.exports.getPrimaryNode = async (server = { ip: "", port: 0 }, ticket) => {
    const response = await axios.get(`https://${server.ip}:${server.port}/api2/json/nodes`, {
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        headers: {
            Cookie: `PVEAuthCookie=${ticket.ticket}`,
        },
    });

    return response.data.data[0];
};

module.exports.openLXCConsole = async (server = { ip: "", port: 0 }, node, containerId, ticket) => {
    const containerPart = containerId === "0" ? "" : `lxc/${containerId}`;

    const response = await axios.post(`https://${server.ip}:${server.port}/api2/json/nodes/${node}/${containerPart}/termproxy`, {}, {
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        headers: {
            Cookie: `PVEAuthCookie=${ticket.ticket}`,
            CSRFPreventionToken: ticket.CSRFPreventionToken,
        },
    });

    return response.data.data;
};

module.exports.openVNCConsole = async (server = { ip: "", port: 0 }, node, vmId, ticket) => {
    const response = await axios.post(`https://${server.ip}:${server.port}/api2/json/nodes/${node}/qemu/${vmId}/vncproxy`, { websocket: 0 }, {
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        headers: {
            Cookie: `PVEAuthCookie=${ticket.ticket}`,
            CSRFPreventionToken: ticket.CSRFPreventionToken,
        },
    });

    return response.data.data;
};