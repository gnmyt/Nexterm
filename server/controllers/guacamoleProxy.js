const WebSocket = require("ws");
module.exports = async (ws, token) => {
    try {
        const guacdUrl = `ws://localhost:58391/?token=${token}`;
        const guacdSocket = new WebSocket(guacdUrl);

        ws.on("message", (message) => {
            guacdSocket.send(message);
        });

        guacdSocket.on("message", (message) => {
            ws.send(message, { binary: false });
        });

        guacdSocket.on("close", () => {
            ws.close();
        });

        guacdSocket.on("error", (error) => {
            console.error("Error in Guacamole WebSocket:", error);
            ws.close(1011, "Internal server error");
        });

        ws.on("close", () => {
            guacdSocket.close();
        });

        ws.on("error", (error) => {
            console.error("Error in client WebSocket:", error);
            guacdSocket.close();
        });
    } catch (error) {
        console.error("Error in guacamoleProxy:", error);
        ws.close(1011, "Internal server error");
    }
}