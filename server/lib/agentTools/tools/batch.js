const { z } = require("zod");
const { ToolError } = require("../context");
const { unpackResult } = require("../results");

const MAX_STEPS = 25;

module.exports = (define, ctx, catalogue) => {
    define("batch", {
        title: "Run several tool calls at once",
        description: "Executes a list of tool calls in one request, by default in order (each step runs after the previous one finished), optionally in parallel. "
            + "Use it for dependent interaction chains such as desktop_click → desktop_type → desktop_key → desktop_screenshot, or to run the same command on several sessions at once. "
            + "Each step names a tool and its arguments exactly as for a direct call; results are returned per step in the same order, screenshots included.",
        inputSchema: {
            steps: z.array(z.object({
                tool: z.string().describe("Name of the tool to call."),
                args: z.record(z.string(), z.any()).optional().describe("Arguments for that tool."),
            })).min(1).max(MAX_STEPS),
            parallel: z.boolean().optional().describe("Run all steps concurrently instead of one after another (default false)."),
            stopOnError: z.boolean().optional().describe("Stop after the first failed step when running in order (default true)."),
        },
        confirm: ({ steps = [] }) => steps.some((step) => Boolean(catalogue.get(step.tool)?.config.confirm)),
    }, async ({ steps, parallel = false, stopOnError = true }) => {
        if (typeof ctx.invokeTool !== "function") throw new ToolError("Batch execution is not available in this context");

        const runStep = async (step, index) => {
            const entry = catalogue.get(step.tool);
            if (!entry || step.tool === "batch") return { index, tool: step.tool, ok: false, error: `Unknown tool: ${step.tool}` };

            const parsed = entry.schema.safeParse(step.args || {});
            if (!parsed.success) {
                const issues = parsed.error.issues.map((issue) => `${issue.path.join(".") || "args"}: ${issue.message}`).join("; ");
                return { index, tool: step.tool, ok: false, error: `Invalid arguments: ${issues}` };
            }

            try {
                const { data, images } = unpackResult(await ctx.invokeTool(step.tool, parsed.data));
                const failed = Boolean(data && typeof data === "object" && (data.denied || data.error));
                return { index, tool: step.tool, ok: !failed, result: data, images };
            } catch (err) {
                return { index, tool: step.tool, ok: false, error: err.message || String(err) };
            }
        };

        let results;
        if (parallel) {
            results = await Promise.all(steps.map(runStep));
        } else {
            results = [];
            for (const [index, step] of steps.entries()) {
                const result = await runStep(step, index);
                results.push(result);
                if (!result.ok && stopOnError) break;
            }
        }

        const images = results.flatMap((r) => r.images || []);
        const summary = {
            completed: results.length,
            total: steps.length,
            failed: results.filter((r) => !r.ok).length,
            steps: results.map(({ images: stepImages, ...rest }) => ({ ...rest, ...(stepImages?.length && { screenshots: stepImages.length }) })),
        };
        return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }, ...images] };
    });
};
