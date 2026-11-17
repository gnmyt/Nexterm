const { z } = require("zod");
const { ToolError } = require("../context");

module.exports = (define, ctx) => {
    if (typeof ctx.askUser !== "function") return;

    define("ask_user", {
        title: "Ask the user a question",
        description: "Pauses and asks the user a question in the chat. Use it when a decision is genuinely theirs to make: which server or path to use, whether to proceed with a risky step, or to request missing information. "
            + "Offer concrete options whenever possible; the user can always type a free-text answer instead. Do not use it for confirmations that the approval flow already covers.",
        inputSchema: {
            question: z.string().min(1).max(2000).describe("The question to show the user."),
            options: z.array(z.object({
                label: z.string().min(1).max(100).describe("Short answer text shown on a button."),
                description: z.string().max(300).optional().describe("One line explaining the consequence of this choice."),
            })).max(6).optional().describe("Suggested answers. Put the recommended one first."),
            multiSelect: z.boolean().optional().describe("Allow picking several options (default false)."),
            allowFreeText: z.boolean().optional().describe("Allow a typed answer besides the options (default true)."),
        },
    }, async ({ question, options = [], multiSelect = false, allowFreeText = true }, { toolCallId } = {}) => {
        const answer = await ctx.askUser({ question, options, multiSelect, allowFreeText }, toolCallId);
        if (answer === null || answer === undefined) throw new ToolError("The user did not answer the question.", "cancelled");
        return { question, answer };
    });
};
