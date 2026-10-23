const SshCertificateAuthority = require("../../models/SshCertificateAuthority");
const { createAuditLog, AUDIT_ACTIONS, RESOURCE_TYPES } = require("../../controllers/audit");
const { normalizeCertificate } = require("./openssh");
const { issueForSession } = require("./certificateAuthority");
const { authorityMatches, selectAuthority } = require("./principals");

const buildSSHParams = (identity, credentials = {}) => {
    const params = { username: identity?.username || credentials.username || "" };
    if (credentials.password) params.password = credentials.password;
    if (credentials.privateKey || credentials["ssh-key"]) params.privateKey = credentials.privateKey || credentials["ssh-key"];
    if (credentials.passphrase) params.passphrase = credentials.passphrase;
    if (credentials["ssh-certificate"]) params.certificate = normalizeCertificate(credentials["ssh-certificate"]);
    return params;
};

const authorityRecord = (authority) => (authority?.get ? authority.get({ plain: true }) : authority);

const chooseAuthority = async ({ entry, account }) => {
    const sshCaId = Number(entry?.config?.sshCaId);
    if (sshCaId) {
        const authority = await SshCertificateAuthority.findByPk(sshCaId, { raw: false });
        if (!authority) throw new Error("SSH certificate authority was not found");
        if (!authorityMatches(authorityRecord(authority), { account, entry })) {
            throw new Error("SSH certificate authority is not available for this account");
        }
        return authority;
    }

    const authorities = await SshCertificateAuthority.findAll({ where: { enabled: true }, raw: false });
    const chosen = selectAuthority(authorities.map(authorityRecord), { account, entry });
    return chosen ? authorities.find((authority) => authority.id === chosen.id) : null;
};

const prepareSshAuth = async ({ entry, identity, credentials, account, session }) => {
    const params = buildSSHParams(identity, credentials);
    const authority = await chooseAuthority({ entry, account });
    if (!authority) return params;

    const issued = await issueForSession({
        ca: { ...authorityRecord(authority), secret: undefined },
        secret: authority.secret,
        identity,
        account,
        entry,
    });

    if (session) session.sshCertificate = issued.metadata;
    if (account?.id) {
        await createAuditLog({
            accountId: account.id,
            organizationId: entry?.organizationId || null,
            action: AUDIT_ACTIONS.SSH_CERTIFICATE_ISSUE,
            resource: RESOURCE_TYPES.ENTRY,
            resourceId: entry?.id || null,
            details: issued.metadata,
        });
    }

    params.privateKey = issued.privateKey;
    params.certificate = issued.certificate;
    delete params.password;
    delete params.passphrase;
    return params;
};

module.exports = { buildSSHParams, prepareSshAuth };
