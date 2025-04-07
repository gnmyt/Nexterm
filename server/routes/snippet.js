const { Router } = require("express");
const { validateSchema } = require("../utils/schema");
const { createSnippet, deleteSnippet, editSnippet, getSnippet, listSnippets } = require("../controllers/snippet");
const { snippetCreationValidation, snippetEditValidation } = require("../validations/snippet");

const app = Router();

app.get("/list", async (req, res) => {
    res.json(await listSnippets(req.user.id));
});

app.get("/:snippetId", async (req, res) => {
    const snippet = await getSnippet(req.user.id, req.params.snippetId);
    if (snippet?.code) return res.json(snippet);

    res.json(snippet);
});

app.put("/", async (req, res) => {
    if (validateSchema(res, snippetCreationValidation, req.body)) return;

    const snippet = await createSnippet(req.user.id, req.body);
    if (snippet?.code) return res.json(snippet);

    res.json({ message: "Snippet created successfully", id: snippet.id });
});

app.patch("/:snippetId", async (req, res) => {
    if (validateSchema(res, snippetEditValidation, req.body)) return;

    const snippet = await editSnippet(req.user.id, req.params.snippetId, req.body);
    if (snippet?.code) return res.json(snippet);

    res.json({ message: "Snippet updated successfully" });
});

app.delete("/:snippetId", async (req, res) => {
    const snippet = await deleteSnippet(req.user.id, req.params.snippetId);
    if (snippet?.code) return res.json(snippet);

    res.json({ message: "Snippet deleted successfully" });
});

module.exports = app;