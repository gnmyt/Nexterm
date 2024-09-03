const GuacamoleLite = require("guacamole-lite");
const net = require("net");
const { GUACD_TOKEN } = require("../index");

let GUACAMOLE_LITE_PORT = 58390;

const checkFreePort = async (port) => {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once("error", () => resolve(false));
        server.once("listening", () => {
            server.close();
            resolve(true);
        });
        server.listen(port, "::");
    });
};

const getFreePort = async () => {
    for (let i = 0; i < 10; i++) {
        const port = Math.floor(Math.random() * 10000) + 50000;
        if (await checkFreePort(port)) {
            return port;
        }
    }
    throw new Error("Could not find a free port for Guacamole");
};

module.exports.startGuacamole = async () => {
    GUACAMOLE_LITE_PORT = await getFreePort();

    console.log("Starting Guacamole on port " + GUACAMOLE_LITE_PORT);

    new GuacamoleLite({ port: GUACAMOLE_LITE_PORT, host: "::" }, { port: 4822 }, {
        crypt: { cypher: "AES-256-CBC", key: GUACD_TOKEN },
        log: { level: 0 },
    }).on("error", () => {
        console.error("Could not connect to guacd. Is it running?");
    });
};

module.exports.getGuacamolePort = () => GUACAMOLE_LITE_PORT;