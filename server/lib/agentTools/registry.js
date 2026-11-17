const registerDiscoveryTools = require("./tools/discovery");
const registerSessionTools = require("./tools/sessions");
const registerTerminalTools = require("./tools/terminal");
const registerFileTools = require("./tools/files");
const registerDesktopTools = require("./tools/desktop");
const registerBatchTool = require("./tools/batch");
const registerInteractionTools = require("./tools/interaction");
const { z } = require("zod");
const SessionManager = require("../SessionManager");

const PASSIVE_TOOLS = new Set(["get_session", "close_session"]);

const withAgentPresence = (name, handler, ctx) => {
    if (PASSIVE_TOOLS.has(name)) return handler;
    return async (args, extra) => {
        const sessionId = typeof args?.sessionId === "string" ? args.sessionId : null;
        const session = sessionId ? SessionManager.get(sessionId) : null;
        if (!session || !ctx.canUseSession(session)) return handler(args, extra);
        const end = SessionManager.beginAgentActivity(sessionId, ctx.origin);
        try {
            return await handler(args, extra);
        } finally {
            end();
        }
    };
};

const schemas = new Map();

const schemaFor = (name, config) => {
    let schema = schemas.get(name);
    if (!schema) {
        schema = z.object(config.inputSchema || {});
        schemas.set(name, schema);
    }
    return schema;
};

const registerAllTools = (define, ctx) => {
    const catalogue = new Map();
    const tracked = (name, config, handler) => {
        const schema = schemaFor(name, config);
        catalogue.set(name, { config, schema });
        define(name, config, withAgentPresence(name, handler, ctx), schema);
    };
    registerDiscoveryTools(tracked, ctx);
    registerSessionTools(tracked, ctx);
    registerTerminalTools(tracked, ctx);
    registerFileTools(tracked, ctx);
    registerDesktopTools(tracked, ctx);
    registerInteractionTools(tracked, ctx);
    registerBatchTool(tracked, ctx, catalogue);
    return catalogue;
};

module.exports = { registerAllTools };
