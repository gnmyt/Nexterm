const { authorizeGuacamole } = require("./auth");
const WebSocket = require("ws");

module.exports = async (req, res) => {
    const token = await authorizeGuacamole(req);
    if (!token) {
        return res.status(403).json({ error: "Unauthorized" });
    }

    const guacdUrl = `ws://localhost:58391/?token=${token}`;
    const guacdSocket = new WebSocket(guacdUrl);

    req.ws.on("message", (message) => {
        guacdSocket.send(message);
    });

    guacdSocket.on("message", (message) => {
        req.ws.send(message, { binary: false });
    });

    guacdSocket.on("close", () => {
        req.ws.close();
    });

    guacdSocket.on("error", (error) => {
        console.error("Error in Guacamole WebSocket:", error);
        req.ws.close(1011, "Internal server error");
    });

    req.ws.on("close", () => {
        guacdSocket.close();
    });

    req.ws.on("error", (error) => {
        console.error("Error in client WebSocket:", error);
        guacdSocket.close();
    });
};