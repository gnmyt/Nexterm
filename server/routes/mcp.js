const { Router } = require("express");
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { createMcpServer } = require("../lib/mcp/server");
const logger = require("../utils/logger");

const app = Router();

const methodNotAllowed = (res) => res.status(405).set("Allow", "POST").json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed. The Nexterm MCP server is stateless: send JSON-RPC requests with POST." },
    id: null,
});

app.post("/", async (req, res) => {
    const server = createMcpServer({
        user: req.user,
        apiKey: req.apiKey || null,
        ipAddress: req.ip || req.socket?.remoteAddress || null,
        userAgent: req.headers["user-agent"] || null,
    });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });

    res.on("close", () => {
        transport.close().catch(() => {});
        server.close().catch(() => {});
    });

    try {
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    } catch (err) {
        logger.error("MCP request failed", { error: err.message });
        if (!res.headersSent) {
            res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
        }
    }
});

app.get("/", (req, res) => methodNotAllowed(res));
app.delete("/", (req, res) => methodNotAllowed(res));

module.exports = app;
