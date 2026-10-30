const { encrypt } = require("./encryption");

const createOIDCSessionContext = (providerId, idToken, encryptToken = encrypt) => {
    const encryptedIdToken = idToken ? encryptToken(idToken) : null;

    return {
        oidcProviderId: providerId,
        oidcIdTokenEncrypted: encryptedIdToken?.encrypted || null,
        oidcIdTokenIV: encryptedIdToken?.iv || null,
        oidcIdTokenAuthTag: encryptedIdToken?.authTag || null,
    };
};

module.exports = { createOIDCSessionContext };
