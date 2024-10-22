const ClientConnection = require('../lib/ClientConnection.js');

module.exports = async (ws, settings) => {
    try {
        this.clientOptions = {
            maxInactivityTime: 10000,

            connectionDefaultSettings: {
                rdp: { 'args': 'connect', 'port': '3389', 'width': 1024, 'height': 768, 'dpi': 96, },
                vnc: { 'args': 'connect', 'port': '5900', 'width': 1024, 'height': 768, 'dpi': 96, },
            }
        };

        new ClientConnection(ws, this.clientOptions, settings);
    } catch (error) {
        console.error("Error in guacamoleProxy:", error);
        ws.close(1011, "Internal server error");
    }
}