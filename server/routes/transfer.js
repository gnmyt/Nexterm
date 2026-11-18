const crypto = require("node:crypto");
const { Router } = require("express");
const { Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const TransferTickets = require("../lib/agentTools/TransferTickets");
const { ToolError } = require("../lib/agentTools/context");
const { resolveSftp } = require("../lib/agentTools/tools/files");
const { isCancelled } = require("../lib/EngineSftpClient");
const { hasResourcePermission } = require("../utils/permission");
const { AUDIT_ACTIONS, RESOURCE_TYPES } = require("../controllers/audit");
const { Permission } = require("../permissions/registry");
const logger = require("../utils/logger");

const app = Router();

const fail = (res, status, error) => {
    if (res.headersSent) return res.destroy();
    res.status(status).json({ error });
};

const statusFor = (err) => {
    if (err.tooLarge) return 413;
    if (err instanceof ToolError) return err.code === "forbidden" ? 403 : 410;
    if (/does not exist|No such file/.test(err.message)) return 404;
    return 502;
};

const hashingCounter = (limit = Infinity) => {
    const hash = crypto.createHash("sha256");
    const counter = new Transform({
        transform(chunk, _encoding, callback) {
            counter.bytes += chunk.length;
            if (counter.bytes > limit) return callback(Object.assign(new Error(`Upload exceeds the limit of ${limit} bytes`), { tooLarge: true }));
            hash.update(chunk);
            callback(null, chunk);
        },
    });
    counter.bytes = 0;
    counter.digest = () => hash.digest("hex");
    return counter;
};

const takeTicket = (req, res, direction) => {
    res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
    const ticket = TransferTickets.peek(req.params.token);
    if (ticket?.direction !== direction) {
        fail(res, ticket ? 405 : 404, ticket ? `This link is for ${ticket.direction}s` : "Unknown, used or expired transfer link");
        return null;
    }
    TransferTickets.start(ticket);
    return ticket;
};

const complete = (ticket, entry, counter) => {
    const result = { bytes: counter.bytes, sha256: counter.digest() };
    TransferTickets.finish(ticket, result);
    const action = ticket.direction === "upload" ? AUDIT_ACTIONS.AGENT_FILE_UPLOAD : AUDIT_ACTIONS.AGENT_FILE_DOWNLOAD;
    ticket.ctx.auditEntry(entry, action, { sessionId: ticket.sessionId, transferId: ticket.id, filePath: ticket.path, ...result }, RESOURCE_TYPES.FILE);
    return result;
};

const abort = (ticket, res, counter, err) => {
    const error = isCancelled(err) ? "Transfer cancelled" : err.message;
    TransferTickets.finish(ticket, { bytes: counter.bytes, error });
    if (!isCancelled(err) && !err.tooLarge) logger.warn("Agent file transfer failed", { transferId: ticket.id, error });
    fail(res, statusFor(err), error);
};

/**
 * GET /transfers/{token}
 * @summary Download a file through an agent transfer link
 * @description Streams a remote file for a single-use link created by the transfer_create MCP tool. The link itself authorizes the request.
 * @tags Transfers
 * @produces application/octet-stream
 * @param {string} token.path.required - Transfer token from the link
 * @return {file} 200 - File content
 * @return {object} 404 - Unknown, used or expired link
 * @return {object} 405 - The link is for uploads
 */
app.get("/:token", async (req, res) => {
    const ticket = takeTicket(req, res, "download");
    if (!ticket) return;

    const counter = hashingCounter();
    let read;
    try {
        const { entry, sftp } = await resolveSftp(ticket.ctx, ticket.sessionId, Permission.FILES_DOWNLOAD);
        const { size } = await sftp.stat(ticket.path);
        const fileName = ticket.path.split("/").pop();
        res.set({
            "Content-Type": "application/octet-stream",
            "Content-Length": String(size),
            "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        });

        read = sftp.readFile(ticket.path);
        await pipeline(read.stream, counter, res);
        await read.done;
        complete(ticket, entry, counter);
    } catch (err) {
        read?.cancel();
        abort(ticket, res, counter, err);
    }
});

/**
 * PUT /transfers/{token}
 * @summary Upload a file through an agent transfer link
 * @description Writes the raw request body to the remote path of a single-use link created by the transfer_create MCP tool. POST is accepted as well. The link itself authorizes the request.
 * @tags Transfers
 * @produces application/json
 * @param {string} token.path.required - Transfer token from the link
 * @return {object} 200 - Path, byte count and sha256 of the stored data
 * @return {object} 404 - Unknown, used or expired link
 * @return {object} 405 - The link is for downloads
 * @return {object} 413 - Upload exceeds the size limit of the link
 */
const upload = async (req, res) => {
    const ticket = takeTicket(req, res, "upload");
    if (!ticket) return;

    const counter = hashingCounter(ticket.maxBytes);
    const abortController = new AbortController();
    req.on("close", () => { if (!req.complete) abortController.abort(); });
    counter.on("error", () => {});
    req.on("error", () => {});

    try {
        const { entry, sftp } = await resolveSftp(ticket.ctx, ticket.sessionId, Permission.FILES_UPLOAD);
        const parent = ticket.path.substring(0, ticket.path.lastIndexOf("/"));
        if (parent && await hasResourcePermission(ticket.ctx.accountId, entry.organizationId, Permission.FILES_MODIFY)) {
            await sftp.mkdirRecursive(parent);
        }

        req.pipe(counter);
        await sftp.writeFile(ticket.path, counter, { signal: abortController.signal });
        res.json({ success: true, path: ticket.path, ...complete(ticket, entry, counter) });
    } catch (err) {
        req.unpipe(counter);
        if (!res.headersSent) res.set("Connection", "close");
        abort(ticket, res, counter, err);
    }
};

app.put("/:token", upload);
app.post("/:token", upload);

module.exports = app;
