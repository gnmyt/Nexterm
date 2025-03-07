const Snippet = require("../models/Snippet");

module.exports.createSnippet = async (accountId, configuration) => {
    return await Snippet.create({ ...configuration, accountId });
};

module.exports.deleteSnippet = async (accountId, snippetId) => {
    const snippet = await Snippet.findOne({ where: { accountId: accountId, id: snippetId } });

    if (snippet === null) {
        return { code: 501, message: "Snippet does not exist" };
    }

    await Snippet.destroy({ where: { id: snippetId } });
};

module.exports.editSnippet = async (accountId, snippetId, configuration) => {
    const snippet = await Snippet.findOne({ where: { accountId: accountId, id: snippetId } });

    if (snippet === null) {
        return { code: 501, message: "Snippet does not exist" };
    }

    await Snippet.update(configuration, { where: { id: snippetId } });
};

module.exports.getSnippet = async (accountId, snippetId) => {
    const snippet = await Snippet.findOne({ where: { accountId: accountId, id: snippetId } });

    if (snippet === null) {
        return { code: 501, message: "Snippet does not exist" };
    }

    return snippet;
};

module.exports.listSnippets = async (accountId) => {
    return await Snippet.findAll({ where: { accountId } });
};