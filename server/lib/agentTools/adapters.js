const logger = require("../../utils/logger");
const { ToolError } = require("./context");
const { registerAllTools } = require("./registry");
const { isContentResult, textResult, errorResult, contentToOutput, outputToModel, toPlainJson } = require("./results");

const reportFailure = (name, err) => {
    const message = err?.message || String(err);
    if (!(err instanceof ToolError)) logger.warn("Agent tool failed", { tool: name, error: message });
    return message;
};

const registerMcpTools = (server, ctx) => {
    const handlers = {};
    const define = (name, config, handler, schema) => {
        const { confirm, inputSchema, ...mcpConfig } = config;
        handlers[name] = handler;
        server.registerTool(name, { ...mcpConfig, inputSchema: schema }, async (args) => {
            try {
                const result = await handler(args ?? {}, { toolCallId: null });
                return isContentResult(result) ? result : textResult(result ?? { ok: true });
            } catch (err) {
                return errorResult(reportFailure(name, err));
            }
        });
    };
    ctx.invokeTool = (name, args) => handlers[name](args ?? {}, { toolCallId: null });
    registerAllTools(define, ctx);
};

const APPROVAL_MODES = new Set(["ask", "allow", "readonly"]);

const buildAiSdkTools = ({ tool, ctx, getApprovalMode = () => "ask", requestApproval = null }) => {
    const tools = {};
    const handlers = {};

    const needsConfirm = (config, args) => (typeof config.confirm === "function" ? config.confirm(args ?? {}) : Boolean(config.confirm));

    const checkApproval = async (name, config, args, { toolCallId, ask }) => {
        if (!needsConfirm(config, args)) return null;
        const mode = getApprovalMode();
        if (mode === "readonly") {
            return { denied: true, message: "The assistant is in read-only mode; the user has to switch to another approval mode for this action." };
        }
        if (ask && mode !== "allow" && requestApproval) {
            const allowed = await requestApproval(name, args, toolCallId);
            if (!allowed) return { denied: true, message: "The user denied this action." };
        }
        return null;
    };

    const define = (name, config, handler, schema) => {
        handlers[name] = { config, handler };
        tools[name] = tool({
            description: config.description,
            inputSchema: schema,
            execute: async (args, { toolCallId, abortSignal }) => {
                if (abortSignal?.aborted) throw new Error("Aborted");
                const denial = await checkApproval(name, config, args, { toolCallId, ask: true });
                if (denial) return denial;
                try {
                    const result = await handler(args ?? {}, { toolCallId });
                    return toPlainJson(isContentResult(result) ? contentToOutput(result) : (result ?? { ok: true }));
                } catch (err) {
                    return { error: reportFailure(name, err) };
                }
            },
            toModelOutput: ({ output }) => outputToModel(output),
        });
    };
    ctx.invokeTool = async (name, args) => {
        const { config, handler } = handlers[name];
        const toolCallId = `batch-${name}`;
        const denial = await checkApproval(name, config, args, { toolCallId, ask: false });
        if (denial) return denial;
        return handler(args ?? {}, { toolCallId });
    };
    registerAllTools(define, ctx);
    return tools;
};

module.exports = { registerMcpTools, buildAiSdkTools, APPROVAL_MODES };
