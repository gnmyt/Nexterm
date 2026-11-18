const { X509Certificate } = require("node:crypto");
const { AsyncLocalStorage } = require("node:async_hooks");
const tls = require("node:tls");
const net = require("node:net");
const { Op } = require("sequelize");
const TrustedHost = require("../models/TrustedHost");
const Account = require("../models/Account");
const Organization = require("../models/Organization");
const Folder = require("../models/Folder");
const { hasOrganizationPermission } = require("./permission");
const { Permission } = require("../permissions/registry");

const KIND = Object.freeze({ SSH: "ssh", TLS: "tls" });
const UNTRUSTED_CODE = "HOST_UNTRUSTED";
const UNTRUSTED_STATUS = 495;
const UNATTENDED_HINT = "Open the server once in Nexterm to trust it.";
const TRUST_CLOSE_CODE = 4020;
const TRUST_CLOSE_REASON = "Certificate verification required";
const SYSTEM_SCOPE = Object.freeze({ accountId: null, organizationId: null });

class UntrustedHostError extends Error {
    constructor(peer, message = null) {
        super(message || `The ${peer.kind === KIND.SSH ? "host key" : "certificate"} of ${peer.host}:${peer.port} is not trusted`);
        this.code = UNTRUSTED_CODE;
        this.peer = peer;
    }
}

const isUntrustedError = (error) => error?.code === UNTRUSTED_CODE && !!error.peer;

const unattendedMessage = (peer) => `${new UntrustedHostError(peer).message}. ${UNATTENDED_HINT}`;

const peerAuditDetails = ({ host, port, kind, fingerprint }) => ({ host, port, kind, fingerprint });

const normalizeHost = (host) => String(host || "").trim().toLowerCase();

const scopeOf = (organizationId, accountId = null) => organizationId
    ? { accountId: null, organizationId }
    : { accountId: accountId ?? null, organizationId: null };

const scopeForEntry = (entry) => scopeOf(entry.organizationId, entry.accountId);

const scopeForIntegration = async (integration) => {
    if (integration.organizationId) return scopeOf(integration.organizationId);
    const root = await Folder.findOne({ where: { integrationId: integration.id, type: "integration-root" } });
    return scopeOf(null, root?.accountId);
};

const scopeLabel = ({ organizationId, accountId }) => organizationId ? "organization" : accountId ? "personal" : "system";

const scopeWhere = (scope) => ({
    accountId: scope.accountId ?? null,
    organizationId: scope.organizationId ?? null,
});

const ignoresWarnings = async (scope) => {
    if (!scope.accountId) return false;
    const account = await Account.findByPk(scope.accountId, { attributes: ["id", "preferences"] });
    return account?.preferences?.security?.ignoreCertificateWarnings === true;
};

const findRecords = (scope, endpoints) => {
    const targets = endpoints
        .filter((endpoint) => endpoint?.host)
        .map((endpoint) => ({ kind: endpoint.kind, host: normalizeHost(endpoint.host), port: Number(endpoint.port) }));
    if (!targets.length) return [];
    return TrustedHost.findAll({ where: { ...scopeWhere(scope), [Op.or]: targets } });
};

const formatPin = (record) =>
    [record.kind, record.host, record.port, record.algorithm || "unknown", record.fingerprint].join(" ");

const loadTrust = async (scope, endpoints, { allowCa = false } = {}) => {
    if (await ignoresWarnings(scope)) return { acceptAny: true, records: [], params: { trust_mode: "any" } };

    const records = await findRecords(scope, endpoints);
    const params = { trust_mode: "pinned" };
    if (records.length) params.trust_pins = records.map(formatPin).join("\n");
    if (allowCa) params.trust_ca = "true";
    return { acceptAny: false, records, params };
};

const tlsTrustParams = async (scope, host, port) =>
    (await loadTrust(scope, [{ kind: KIND.TLS, host, port }], { allowCa: true })).params;

const scopeStorage = new AsyncLocalStorage();

const withScope = (scope, fn) => scopeStorage.run(scope, fn);

const currentScope = () => scopeStorage.getStore() || null;

const openTrustedTlsSocket = async (scope, host, port, { timeout = 10000 } = {}) => {
    const { acceptAny, records: pins } = await loadTrust(scope, [{ kind: KIND.TLS, host, port }]);

    return new Promise((resolve, reject) => {
        const socket = tls.connect({
            host, port: Number(port), rejectUnauthorized: false,
            servername: net.isIP(host) ? undefined : host,
        });
        const fail = (error) => { socket.destroy(); reject(error); };

        socket.setTimeout(timeout, () => fail(new Error(`Connection to ${host}:${port} timed out`)));
        socket.once("error", reject);
        socket.once("secureConnect", () => {
            socket.setTimeout(0);
            const certificate = socket.getPeerX509Certificate();
            if (!certificate) return fail(new Error(`${host}:${port} did not present a certificate`));
            if (acceptAny || socket.authorized) return resolve(socket);

            const fingerprint = certificate.fingerprint256;
            if (pins.some((pin) => pin.fingerprint === fingerprint)) return resolve(socket);

            fail(new UntrustedHostError({
                kind: KIND.TLS,
                host,
                port: Number(port),
                algorithm: certificate.publicKey.asymmetricKeyType?.toUpperCase() || null,
                fingerprint,
                raw: certificate.raw.toString("base64"),
            }));
        });
    });
};

const firstValue = (value) => (Array.isArray(value) ? value[0] : value) || null;

const parseDistinguishedName = (text) => {
    const fields = {};
    for (const line of String(text || "").split("\n")) {
        const index = line.indexOf("=");
        if (index > 0) fields[line.slice(0, index).trim()] = line.slice(index + 1).trim();
    }
    return fields;
};

const describeCertificate = ({ raw, subject, issuer }) => {
    if (!raw) {
        if (!subject && !issuer) return null;
        const issuerName = /CN\s*=\s*([^,]+)/.exec(issuer || "")?.[1]?.trim() || issuer || null;
        return { subject: subject || null, issuer: issuerName, selfSigned: !!subject && subject === issuerName };
    }
    try {
        const certificate = new X509Certificate(Buffer.from(raw, "base64"));
        const subject = parseDistinguishedName(certificate.subject);
        const issuer = parseDistinguishedName(certificate.issuer);
        return {
            subject: firstValue(subject.CN) || certificate.subject.replaceAll("\n", ", "),
            issuer: firstValue(issuer.CN) || firstValue(issuer.O) || certificate.issuer.replaceAll("\n", ", "),
            organization: firstValue(subject.O),
            validFrom: new Date(certificate.validFrom).toISOString(),
            validTo: new Date(certificate.validTo).toISOString(),
            altNames: certificate.subjectAltName || null,
            serialNumber: certificate.serialNumber,
            selfSigned: certificate.subject === certificate.issuer,
        };
    } catch {
        return null;
    }
};

const describePeer = (peer) => ({
    kind: peer.kind,
    host: peer.host,
    port: peer.port,
    algorithm: peer.algorithm || null,
    fingerprint: peer.fingerprint,
    certificate: peer.kind === KIND.TLS ? describeCertificate(peer) : null,
});

const findRecord = (scope, peer) => TrustedHost.findOne({
    where: { ...scopeWhere(scope), kind: peer.kind, host: normalizeHost(peer.host), port: Number(peer.port) },
});

const canAcceptChange = async (scope, accountId) => {
    if (scope.organizationId) {
        return hasOrganizationPermission(accountId, scope.organizationId, Permission.ORG_CERTIFICATES_MANAGE);
    }
    return true;
};

const describeChallenge = async (scope, peer, accountId) => {
    const existing = await findRecord(scope, peer);
    const changed = !!existing && existing.fingerprint !== peer.fingerprint;

    let organizationName = null;
    if (scope.organizationId) {
        const organization = await Organization.findByPk(scope.organizationId, { attributes: ["name"] });
        organizationName = organization?.name || null;
    }

    return {
        ...describePeer(peer),
        status: changed ? "changed" : "new",
        scope: scopeLabel(scope),
        organizationName,
        canAccept: changed ? await canAcceptChange(scope, accountId) : true,
        previous: changed ? {
            algorithm: existing.algorithm,
            fingerprint: existing.fingerprint,
            certificate: existing.kind === KIND.TLS ? describeCertificate(existing) : null,
        } : null,
    };
};

const acceptPeer = async (scope, peer, accountId) => {
    const existing = await findRecord(scope, peer);
    const changed = !!existing && existing.fingerprint !== peer.fingerprint;

    if (changed && !(await canAcceptChange(scope, accountId))) {
        return { code: 403, message: "You don't have permission to accept a changed certificate for this organization" };
    }

    if (existing) await TrustedHost.destroy({ where: { id: existing.id } });

    const record = await TrustedHost.create({
        ...scopeWhere(scope),
        kind: peer.kind,
        host: normalizeHost(peer.host),
        port: Number(peer.port),
        algorithm: peer.algorithm || null,
        fingerprint: peer.fingerprint,
        raw: peer.raw || null,
        subject: peer.subject || null,
        issuer: peer.issuer || null,
    });

    return { record, changed, previousFingerprint: changed ? existing.fingerprint : null };
};

const runTrusted = async (scope, accountId, acceptFingerprint, fn) => {
    try {
        return await withScope(scope, fn);
    } catch (error) {
        if (!isUntrustedError(error) || !acceptFingerprint || acceptFingerprint !== error.peer.fingerprint) throw error;

        const accepted = await acceptPeer(scope, error.peer, accountId);
        if (accepted.code) throw Object.assign(new Error(accepted.message), { trustDenied: accepted });
        return withScope(scope, fn);
    }
};

const trustFailureResponse = async (scope, error, accountId) => {
    if (error?.trustDenied) return error.trustDenied;
    if (!isUntrustedError(error)) return null;
    return {
        code: UNTRUSTED_STATUS,
        message: error.message,
        untrustedPeer: await describeChallenge(scope, error.peer, accountId),
    };
};

module.exports = {
    KIND,
    SYSTEM_SCOPE,
    TRUST_CLOSE_CODE,
    TRUST_CLOSE_REASON,
    UntrustedHostError,
    isUntrustedError,
    unattendedMessage,
    peerAuditDetails,
    normalizeHost,
    scopeOf,
    scopeForEntry,
    scopeForIntegration,
    scopeLabel,
    withScope,
    currentScope,
    openTrustedTlsSocket,
    loadTrust,
    tlsTrustParams,
    describePeer,
    describeChallenge,
    acceptPeer,
    runTrusted,
    trustFailureResponse,
};
