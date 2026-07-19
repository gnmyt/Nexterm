const { z } = require("zod");
const MonitoringSnapshot = require("../../models/MonitoringSnapshot");
const logger = require("../../utils/logger");
const { buildModel, getModelProviderOptions } = require("./providers");

const MAX_SUGGESTIONS = 3;

const SYSTEM_PROMPT = `You turn a natural language request into shell commands that the user will review in their terminal before running them.

Rules:
- Return up to ${MAX_SUGGESTIONS} distinct single-line commands, best first. Each one must fully answer the request on its own.
- Make the alternatives genuinely different (different tool, different flags, different approach), not cosmetic variations.
- Never wrap a command in markdown, backticks or quotes, and never prefix it with a shell prompt.
- Keep every command non-interactive: no editors, no pagers, nothing that waits for input.
- Chain steps with && or ; when the request needs more than one step. Never emit a newline inside a command.
- Use sudo only when the task genuinely requires root.
- Prefer tools present on a default installation of the target system.
- Do not invent file paths, package names or hostnames.
- Return only commands. No explanations, no comments, no prose.`;

const COMMAND_SCHEMA = z.object({
    commands: z.array(z.string()).min(1).max(MAX_SUGGESTIONS)
        .describe("Shell commands, best first, without markdown formatting or a prompt prefix"),
});

const buildContext = async (entry, shell) => {
    const parts = [];
    if (shell) parts.push(`shell: ${shell}`);

    const protocol = entry?.type === "server" ? entry?.config?.protocol : entry?.type;
    if (protocol) parts.push(`protocol: ${protocol}`);

    try {
        const snapshot = entry ? await MonitoringSnapshot.findOne({ where: { entryId: entry.id } }) : null;
        const os = snapshot?.osInfo;
        if (os?.name) parts.push(`distro: ${os.name}${os.version ? " " + os.version : ""}`);
        if (os?.kernel) parts.push(`kernel: ${os.kernel}`);
    } catch (error) {
        logger.error("Failed to load monitoring snapshot for command generation", { error: error.message });
    }

    return parts;
};

const stripFormatting = (command) => {
    let value = String(command || "").trim();
    if (value.startsWith("```")) {
        value = value.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
    }
    if (value.startsWith("$ ")) value = value.slice(2).trim();
    return value.split("\n").map((line) => line.trim()).filter(Boolean).join(" ");
};

module.exports.generateCommand = async ({ settings, entry, prompt, shell, rejected, abortSignal }) => {
    const { generateObject } = await import("ai");

    const context = await buildContext(entry, shell);
    let system = SYSTEM_PROMPT;
    if (context.length) system += `\n\nTarget server: ${context.join(", ")}.`;
    if (rejected?.length) {
        system += "\n\nThe user rejected these suggestions, so propose different approaches:\n"
            + rejected.map((command) => `- ${command}`).join("\n");
    }

    const { object } = await generateObject({
        model: await buildModel(settings),
        providerOptions: getModelProviderOptions(settings),
        schema: COMMAND_SCHEMA,
        system,
        prompt,
        abortSignal,
    });

    const commands = [...new Set((object.commands || []).map(stripFormatting).filter(Boolean))]
        .slice(0, MAX_SUGGESTIONS);
    if (!commands.length) return { code: 502, message: "The model did not return a command" };

    return { commands };
};
