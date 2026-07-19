const MonitoringSnapshot = require("../../models/MonitoringSnapshot");
const logger = require("../../utils/logger");

const BASE_PROMPT = `You are the Nexterm assistant, operating directly on a remote server through a live SSH connection.

You can inspect and change the server by calling the provided tools. Each tool runs against the same host the user is connected to. There is no local shell state shared between calls: every runCommand executes in a fresh shell, so chain dependent steps in a single command or use absolute paths.

Guidelines:
- Investigate before acting. Read files and inspect state with the read-only tools before making changes.
- Prefer the dedicated file tools (readFile, writeFile, editFile, listDirectory, statPath) over shelling out with cat/ls when you just need file contents or listings.
- To change part of an existing file, use editFile (exact snippet replacement) rather than rewriting the whole file with writeFile.
- Keep commands non-interactive. Never launch editors, pagers, or programs that wait for input.
- sudo works: use it normally when a command needs root. The password is supplied automatically, so never ask the user for it, echo it, or add -S yourself. If sudo reports that no password was provided, the connection has no stored password and you should report that instead of retrying.
- Explain what you are about to do in a short sentence, then call the tool. After tool results return, summarise what happened.
- Be precise and concise. Report exact command output, exit codes, and paths.
- When a task is complete, state clearly that it is done.`;

const buildServerContext = async (entry) => {
    const parts = [];
    if (entry?.name) parts.push(`name: ${entry.name}`);
    const protocol = entry?.type === "server" ? entry?.config?.protocol : entry?.type;
    if (protocol) parts.push(`protocol: ${protocol}`);
    if (entry?.config?.ip) parts.push(`host: ${entry.config.ip}`);

    try {
        const snapshot = entry ? await MonitoringSnapshot.findOne({ where: { entryId: entry.id } }) : null;
        const os = snapshot?.osInfo;
        if (os?.name) parts.push(`distro: ${os.name}${os.version ? " " + os.version : ""}`);
        if (os?.kernel) parts.push(`kernel: ${os.kernel}`);
        if (os?.hostname) parts.push(`hostname: ${os.hostname}`);
    } catch (error) {
        logger.error("Failed to load monitoring snapshot for AI context", { error: error.message });
    }

    return parts;
};

module.exports.buildSystemPrompt = async (entry) => {
    const context = await buildServerContext(entry);

    let prompt = BASE_PROMPT;
    if (context.length) prompt += `\n\nConnected server: ${context.join(", ")}.`;

    const custom = process.env.AI_SYSTEM_PROMPT?.trim();
    if (custom) prompt += `\n\nAdditional operator instructions:\n${custom}`;

    return prompt;
};
