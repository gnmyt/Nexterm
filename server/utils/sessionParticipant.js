const SessionManager = require("../lib/SessionManager");

const buildParticipant = (ctx) => ({
    accountId: ctx.user?.id || null,
    username: ctx.user?.username || null,
    firstName: ctx.user?.firstName || null,
    lastName: ctx.user?.lastName || null,
    avatarHash: ctx.user?.avatarHash || null,
    kind: !ctx.isShared ? "owner" : ctx.isOrgJoin ? "organization" : "link",
    writable: !ctx.isShared ? true : ctx.shareWritable === true,
});

const createWriteGuard = (ctx, sessionId) => {
    if (!ctx.isShared) return () => true;
    if (ctx.isOrgJoin) return () => ctx.shareWritable === true;
    return () => SessionManager.get(sessionId)?.shareWritable === true;
};

module.exports = { buildParticipant, createWriteGuard };
