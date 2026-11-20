const { Router } = require("express");
const { createEntry, deleteEntry, editEntry, getEntry, listEntries, duplicateEntry, importSSHConfig, repositionEntry, getRecentConnections, wakeEntry } = require("../controllers/entry");
const { createServerValidation, updateServerValidation, repositionServerValidation, importSSHConfigValidation } = require("../validations/server");
const Joi = require("joi");
const { route } = require("../utils/route");
const { objectList, message, created } = require("../validations/common");

const app = Router();


app.get("/recent", route({
    summary: "List recent connections",
    description: "Returns the entries the account connected to most recently.",
    query: Joi.object({ limit: Joi.number().integer().default(5).description("Maximum number of entries to return") }),
    returns: objectList,
}), async (req, res) => {
    res.json(await getRecentConnections(req.user.id, req.query.limit));
});

app.get("/list", route({
    summary: "List entries",
    description: "Returns every entry the account can access as a tree: organizations and folders contain their entries in `entries`, entries without a folder are at the top level.",
    returns: objectList,
}), async (req, res) => {
    res.json(await listEntries(req.user.id));
});

app.get("/:entryId", route({
    summary: "Get entry",
    description: "Returns a single entry. `config` is the effective configuration including values inherited from its folders, `localConfig` holds only what is set on the entry itself.",
}), async (req, res) => {
    const entry = await getEntry(req.user.id, req.params.entryId);
    if (entry?.code) return res.json(entry);

    res.json(entry);
});

app.put("/", route({
    summary: "Create entry",
    description: "Creates a server entry. `identities` accepts ids of existing identities as well as new identities as objects, so a host and its credentials can be created in one request. New identities are limited to this entry unless `global` is set.",
    body: createServerValidation,
    returns: created,
}), async (req, res) => {
    const entry = await createEntry(req.user.id, req.body);
    if (entry?.code) return res.json(entry);

    res.json({ message: "Entry got successfully created", id: entry.id });
});

app.delete("/:entryId", route({
    summary: "Delete entry",
    description: "Permanently removes an entry.",
    returns: message,
}), async (req, res) => {
    const entry = await deleteEntry(req.user.id, req.params.entryId);
    if (entry?.code) return res.json(entry);

    res.json({ message: "Entry got successfully deleted" });
});

app.patch("/:entryId", route({
    summary: "Update entry",
    description: "Changes an entry. Only the fields you send are changed. `identities` replaces the list of identities of the entry.",
    body: updateServerValidation,
    returns: message,
}), async (req, res) => {
    const entry = await editEntry(req.user.id, req.params.entryId, req.body);
    if (entry?.code) return res.json(entry);

    res.json({ message: "Entry got successfully edited" });
});

app.post("/:entryId/duplicate", route({
    summary: "Duplicate entry",
    description: "Creates a copy of an entry with all of its settings.",
    returns: message,
}), async (req, res) => {
    const entry = await duplicateEntry(req.user.id, req.params.entryId);
    if (entry?.code) return res.json(entry);

    res.json({ message: "Entry got successfully duplicated" });
});

app.post("/import/ssh-config", route({
    summary: "Import SSH config",
    description: "Imports hosts that the client parsed from an SSH config file. This is what the import dialog of the web interface uses.",
    body: importSSHConfigValidation,
    returns: message.keys({
        imported: Joi.number().integer().required(),
        skipped: Joi.number().integer().required(),
        errors: Joi.number().integer().required(),
        details: objectList.required(),
    }),
}), async (req, res) => {
    const result = await importSSHConfig(req.user.id, req.body);
    if (result?.code) return res.json(result);

    res.json(result);
});

app.patch("/:entryId/reposition", route({
    summary: "Reposition entry",
    description: "Moves an entry before or after another entry, or to the end of a folder when no `targetId` is given.",
    body: repositionServerValidation,
    returns: message.keys({ success: Joi.boolean(), removedIdentityCount: Joi.number().integer() }),
}), async (req, res) => {
    const result = await repositionEntry(req.user.id, req.params.entryId, req.body);
    if (result?.code) return res.json(result);

    res.json({ message: "Entry successfully repositioned", ...result });
});

app.post("/:entryId/wake", route({
    summary: "Wake entry",
    description: "Sends a Wake-on-LAN packet to the server. The entry needs a MAC address.",
    returns: message,
}), async (req, res) => {
    const result = await wakeEntry(req.user.id, req.params.entryId);
    if (result?.code) return res.json(result);

    res.json({ message: "Wake-On-LAN packet sent successfully" });
});

module.exports = app;
