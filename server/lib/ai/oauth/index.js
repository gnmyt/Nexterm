const { client: anthropic, OAUTH_BETA } = require("./anthropic");
const { client: openaiCodex } = require("./openaiCodex");

const CLIENTS = {
    [anthropic.id]: anthropic,
    [openaiCodex.id]: openaiCodex,
};

const getOAuthClient = (providerId) => CLIENTS[providerId] || null;

module.exports = { getOAuthClient, ANTHROPIC_OAUTH_BETA: OAUTH_BETA };
