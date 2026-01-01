const { transformScript, getScriptCommands, processNextermLine, checkSudoPrompt } = require("../utils/scriptUtils");
const SessionManager = require("./SessionManager");
const logger = require("../utils/logger");

const SCRIPT_MAGIC = "\x1F";
const MSG = {
    SCRIPT_START: "script_start", STEP: "step", PROMPT: "prompt", WARNING: "warning",
    INFO: "info", SUCCESS: "success", CONFIRM: "confirm", PROGRESS: "progress",
    SUMMARY: "summary", TABLE: "table", MSGBOX: "msgbox", SCRIPT_END: "script_end",
    INPUT_RESPONSE: "input_response", INPUT_CANCELLED: "input_cancelled"
};

const DIALOG_TYPES = new Set([MSG.PROMPT, MSG.CONFIRM, MSG.SUMMARY, MSG.TABLE, MSG.MSGBOX]);

class ScriptLayer {
    constructor(stream, ws, script, sessionId) {
        this.stream = stream;
        this.sessionId = sessionId;
        this.script = script;
        this.step = 1;
        this.pending = null;
        this.buffer = "";
        this.running = false;
        this.handlers = new Set();
        this.events = [];
        this.commandQueue = [];
        this.commandIndex = 0;
        this.onData = this.onData.bind(this);
        this.onClose = this.onClose.bind(this);
    }

    broadcast(type, payload = {}) {
        const msg = SCRIPT_MAGIC + JSON.stringify({ type, ...payload });
        if (!DIALOG_TYPES.has(type)) {
            this.events.push(msg);
        }
        const session = SessionManager.get(this.sessionId);
        if (session) for (const ws of session.connectedWs) ws.readyState === ws.OPEN && ws.send(msg);
    }

    replayEvents(ws) {
        for (const msg of this.events) ws.readyState === ws.OPEN && ws.send(msg);
        if (this.pending) {
            const msg = SCRIPT_MAGIC + JSON.stringify({ type: MSG.PROMPT, inputType: this.pending.inputType || this.pending.type, ...this.pending });
            ws.readyState === ws.OPEN && ws.send(msg);
        }
    }

    start() {
        this.running = true;
        logger.info("Script starting", { sessionId: this.sessionId, name: this.script.name });
        this.broadcast(MSG.SCRIPT_START, { name: this.script.name });
        
        const { b64 } = transformScript(this.script.content);
        this.commandQueue = getScriptCommands(b64);
        this.commandIndex = 0;
        
        this.stream.on("data", this.onData);
        this.stream.on("close", this.onClose);

        this.writeNextCommand();
    }

    writeNextCommand() {
        if (this.commandIndex < this.commandQueue.length) {
            const cmd = this.commandQueue[this.commandIndex++];
            this.stream.write(cmd + "\n");
            
            if (this.commandIndex < this.commandQueue.length) {
                setTimeout(() => this.writeNextCommand(), 50);
            }
        }
    }

    onData(data) { this.processOutput(data.toString()); }

    processOutput(output) {
        const sudo = checkSudoPrompt(output);
        if (sudo) { this.pending = sudo; this.broadcast(MSG.PROMPT, { inputType: "password", ...sudo }); return; }
        this.buffer += output;
        const lines = this.buffer.split("\n");
        this.buffer = lines.pop() || "";
        lines.forEach(l => this.processLine(l));
    }

    processLine(line) {
        const cmd = processNextermLine(line);
        if (!cmd) return;
        switch (cmd.type) {
            case "input": case "select":
                this.pending = cmd;
                this.broadcast(MSG.PROMPT, { inputType: cmd.type, variable: cmd.variable, prompt: cmd.prompt, default: cmd.default, options: cmd.options });
                break;
            case "step": this.broadcast(MSG.STEP, { number: this.step++, description: cmd.description }); break;
            case "warning": this.broadcast(MSG.WARNING, { message: cmd.message }); break;
            case "info": this.broadcast(MSG.INFO, { message: cmd.message }); break;
            case "success": this.broadcast(MSG.SUCCESS, { message: cmd.message }); break;
            case "confirm":
                this.pending = { variable: "NEXTERM_CONFIRM_RESULT", prompt: cmd.message, inputType: "confirm" };
                this.broadcast(MSG.CONFIRM, this.pending);
                break;
            case "progress": this.broadcast(MSG.PROGRESS, { percentage: cmd.percentage, message: cmd.message || "" }); break;
            case "summary":
                this.pending = { variable: "NEXTERM_SUMMARY_RESULT", inputType: "summary" };
                this.broadcast(MSG.SUMMARY, { title: cmd.title, data: cmd.data });
                break;
            case "table":
                this.pending = { variable: "NEXTERM_TABLE_RESULT", inputType: "table" };
                this.broadcast(MSG.TABLE, { title: cmd.title, data: cmd.data });
                break;
            case "msgbox":
                this.pending = { variable: "NEXTERM_MSGBOX_RESULT", inputType: "msgbox" };
                this.broadcast(MSG.MSGBOX, { title: cmd.title, message: cmd.message });
                break;
            case "end": this.handleEnd(cmd.exitCode); break;
        }
    }

    createMessageHandler(ws) {
        const handler = (msg) => {
            const str = msg.toString();
            if (!str.startsWith(SCRIPT_MAGIC)) return;
            try {
                const data = JSON.parse(str.slice(1));
                if (data.type === MSG.INPUT_RESPONSE && this.pending) {
                    this.stream.write((data.value || this.pending.default || "") + "\n");
                    this.pending = null;
                } else if (data.type === MSG.INPUT_CANCELLED) {
                    this.stream.write("\x03");
                    this.pending = null;
                }
            } catch (e) {}
        };
        ws.on("message", handler);
        this.handlers.add({ ws, handler });
        this.replayEvents(ws);
        return handler;
    }

    removeMessageHandler(ws) {
        for (const entry of this.handlers) {
            if (entry.ws === ws) { ws.removeListener("message", entry.handler); this.handlers.delete(entry); break; }
        }
    }

    handleEnd(exitCode) {
        if (!this.running) return;
        this.running = false;
        if (this.buffer.trim()) this.processLine(this.buffer);
        this.buffer = "";
        this.broadcast(MSG.SCRIPT_END, { exitCode, success: exitCode === 0 });
        logger.info("Script completed", { sessionId: this.sessionId, exitCode });
        this.stream.removeListener("data", this.onData);
    }

    onClose(code) { if (this.running) this.handleEnd(code); }

    destroy() {
        this.stream.removeListener("data", this.onData);
        this.stream.removeListener("close", this.onClose);
        for (const { ws, handler } of this.handlers) ws.removeListener("message", handler);
        this.handlers.clear();
        this.running = false;
    }
}

module.exports = { ScriptLayer, SCRIPT_MAGIC, MSG };
