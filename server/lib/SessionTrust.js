const SessionManager = require("./SessionManager");
const Entry = require("../models/Entry");
const Integration = require("../models/Integration");
const hostTrust = require("../utils/hostTrust");
const logger = require("../utils/logger");

const scopeForSessionEntry = async (entry) => {
    if (entry.integrationId && entry.type?.startsWith("pve-")) {
        const integration = await Integration.findByPk(entry.integrationId);
        if (integration) return hostTrust.scopeForIntegration(integration);
    }
    return hostTrust.scopeForEntry(entry);
};

const raiseChallenge = async (sessionId, error) => {
    if (!hostTrust.isUntrustedError(error)) return false;

    const session = SessionManager.get(sessionId);
    if (!session) return true;

    if (session.automated || !session.configuration?.trustPrompt) {
        error.message = hostTrust.unattendedMessage(error.peer);
        return true;
    }

    const entry = await Entry.findByPk(session.entryId);
    if (!entry) return true;

    const scope = await scopeForSessionEntry(entry);
    const view = await hostTrust.describeChallenge(scope, error.peer, session.accountId);

    SessionManager.setTrustChallenge(sessionId, { scope, peer: error.peer, view, createdAt: Date.now() });
    logger.info("Session is waiting for certificate verification", {
        sessionId, ...hostTrust.peerAuditDetails(error.peer), status: view.status,
    });
    return true;
};

module.exports = { raiseChallenge, scopeForSessionEntry };
