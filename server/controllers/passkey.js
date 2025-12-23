const { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } = require("@simplewebauthn/server");
const Account = require("../models/Account");
const Passkey = require("../models/Passkey");
const Session = require("../models/Session");
const logger = require("../utils/logger");

const rpName = "Nexterm";
const challengeStore = new Map();
const CHALLENGE_TTL = 5 * 60 * 1000;

const storeChallenge = (challenge, data = {}) => {
    for (const [key, entry] of challengeStore.entries()) {
        if (Date.now() - entry.timestamp > CHALLENGE_TTL) challengeStore.delete(key);
    }
    challengeStore.set(challenge, { timestamp: Date.now(), ...data });
};

const consumeChallenge = (challenge) => {
    const entry = challengeStore.get(challenge);
    if (!entry || Date.now() - entry.timestamp > CHALLENGE_TTL) {
        challengeStore.delete(challenge);
        return null;
    }
    challengeStore.delete(challenge);
    return entry;
};

const toBase64url = (uint8Array) => Buffer.from(uint8Array).toString("base64url");
const fromBase64url = (base64url) => new Uint8Array(Buffer.from(base64url, "base64url"));

module.exports.generateRegistrationOptions = async (req, accountId, origin) => {
    const account = await Account.findByPk(accountId);
    if (!account) return { code: 102, message: "Account not found" };

    const existingPasskeys = await Passkey.findAll({ where: { accountId } });
    const rpID = new URL(origin).hostname;

    const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userID: Buffer.from(account.id.toString()),
        userName: account.username,
        userDisplayName: `${account.firstName} ${account.lastName}`,
        attestationType: "none",
        excludeCredentials: existingPasskeys.map(p => ({
            id: p.credentialId,
            type: "public-key",
            transports: p.transports ? JSON.parse(p.transports) : undefined,
        })),
        authenticatorSelection: { residentKey: "preferred", userVerification: "preferred", authenticatorAttachment: "platform" },
    });

    storeChallenge(options.challenge, { type: "registration", accountId });
    return options;
};

module.exports.verifyRegistration = async (req, accountId, response, passkeyName, origin) => {
    const account = await Account.findByPk(accountId);
    if (!account) return { code: 102, message: "Account not found" };

    const clientData = JSON.parse(Buffer.from(response.response.clientDataJSON, 'base64url').toString());
    const challengeEntry = consumeChallenge(clientData.challenge);
    
    if (!challengeEntry || challengeEntry.type !== "registration" || challengeEntry.accountId !== accountId) {
        return { code: 301, message: "No valid registration challenge found" };
    }

    try {
        const verification = await verifyRegistrationResponse({
            response,
            expectedChallenge: clientData.challenge,
            expectedOrigin: origin,
            expectedRPID: new URL(origin).hostname,
        });

        if (!verification.verified || !verification.registrationInfo) {
            return { code: 302, message: "Registration verification failed" };
        }

        const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

        await Passkey.create({
            credentialId: credential.id,
            credentialPublicKey: toBase64url(credential.publicKey),
            counter: credential.counter,
            credentialDeviceType,
            credentialBackedUp,
            transports: response.response.transports ? JSON.stringify(response.response.transports) : null,
            accountId,
            name: passkeyName || "Passkey",
        });

        logger.system(`Passkey registered for user ${account.username}`, { accountId });
        return { verified: true };
    } catch (error) {
        logger.error(`Passkey registration failed: ${error.message}`, { accountId });
        return { code: 303, message: error.message || "Registration verification failed" };
    }
};

module.exports.generateAuthenticationOptions = async (req, username, origin) => {
    let allowCredentials = [];
    let accountId = null;
    const rpID = new URL(origin).hostname;

    if (username) {
        const account = await Account.findOne({ where: { username } });
        if (!account) return { code: 201, message: "Account not found" };
        accountId = account.id;

        const passkeys = await Passkey.findAll({ where: { accountId: account.id } });
        if (passkeys.length === 0) return { code: 304, message: "No passkeys registered" };

        allowCredentials = passkeys.map(p => ({
            id: p.credentialId,
            type: "public-key",
            transports: p.transports ? JSON.parse(p.transports) : undefined,
        }));
    }

    const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
        userVerification: "preferred",
    });

    storeChallenge(options.challenge, { type: "authentication", accountId });

    return { options, accountId };
};

module.exports.verifyAuthentication = async (req, response, user, origin) => {
    try {
        const passkey = await Passkey.findOne({ where: { credentialId: response.id } });
        if (!passkey) return { code: 305, message: "Passkey not found" };

        const account = await Account.findByPk(passkey.accountId);
        if (!account) return { code: 102, message: "Account not found" };

        const clientData = JSON.parse(Buffer.from(response.response.clientDataJSON, 'base64url').toString());
        const challengeEntry = consumeChallenge(clientData.challenge);
        
        if (!challengeEntry || challengeEntry.type !== "authentication") {
            return { code: 301, message: "No valid authentication challenge found" };
        }

        const verification = await verifyAuthenticationResponse({
            response,
            expectedChallenge: clientData.challenge,
            expectedOrigin: origin,
            expectedRPID: new URL(origin).hostname,
            credential: {
                id: passkey.credentialId,
                publicKey: fromBase64url(passkey.credentialPublicKey),
                counter: passkey.counter,
                transports: passkey.transports ? JSON.parse(passkey.transports) : undefined,
            },
        });

        if (!verification.verified) return { code: 306, message: "Authentication verification failed" };

        await Passkey.update({ counter: verification.authenticationInfo.newCounter }, { where: { id: passkey.id } });

        const session = await Session.create({ accountId: account.id, ip: user.ip, userAgent: user.userAgent });
        logger.system(`User ${account.username} logged in via passkey`, { accountId: account.id, ip: user.ip });

        return { verified: true, token: session.token };
    } catch (error) {
        logger.error(`Passkey authentication failed: ${error.message}`);
        return { code: 307, message: error.message || "Authentication verification failed" };
    }
};

module.exports.listPasskeys = async (accountId) => {
    return await Passkey.findAll({
        where: { accountId },
        attributes: ["id", "name", "createdAt"],
        order: [["createdAt", "DESC"]],
    });
};

module.exports.deletePasskey = async (accountId, passkeyId) => {
    const passkey = await Passkey.findOne({ where: { id: passkeyId, accountId } });
    if (!passkey) return { code: 308, message: "Passkey not found" };

    await Passkey.destroy({ where: { id: passkeyId } });
    const account = await Account.findByPk(accountId);
    logger.system(`Passkey deleted for user ${account?.username}`, { accountId, passkeyId });
    return { deleted: true };
};

module.exports.renamePasskey = async (accountId, passkeyId, name) => {
    const passkey = await Passkey.findOne({ where: { id: passkeyId, accountId } });
    if (!passkey) return { code: 308, message: "Passkey not found" };

    await Passkey.update({ name }, { where: { id: passkeyId } });
    return { renamed: true };
};
