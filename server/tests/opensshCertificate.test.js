const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const crypto = require("node:crypto");

const {
    generateEd25519KeyPair,
    publicKeyFromPrivate,
    signUserCertificate,
    normalizeCertificate,
    describeCertificate,
    loadEd25519PrivateKey,
} = require("../lib/ssh/openssh");
const { resolvePrincipals, renderKeyId, normalizeSourceAddress, clampTtl, selectAuthority, resolveTtl } = require("../lib/ssh/principals");
const { issueForSession } = require("../lib/ssh/certificateAuthority");
const { mintStepSshToken } = require("../lib/ssh/stepToken");

const sshKeygen = () => {
    try {
        execFileSync("ssh-keygen", ["-h"], { stdio: "ignore" });
        return true;
    } catch (error) {
        return error.status === 1 || error.status === 0;
    }
};

test("generates an OpenSSH key that ssh-keygen can read", (t) => {
    if (!sshKeygen()) {
        t.skip("OpenSSH ssh-keygen is not available");
        return;
    }
    const pair = generateEd25519KeyPair("session");
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nexterm-ssh-"));
    const keyPath = path.join(directory, "id_ed25519");
    fs.writeFileSync(keyPath, pair.privateKey, { mode: 0o600 });
    const derived = execFileSync("ssh-keygen", ["-y", "-f", keyPath], { encoding: "utf8" }).trim();
    assert.equal(derived.split(" ")[0], "ssh-ed25519");
    assert.equal(derived.split(" ")[1], pair.publicKey.split(" ")[1]);
    fs.rmSync(directory, { recursive: true, force: true });
});

test("signs a user certificate ssh-keygen can inspect", () => {
    const ca = generateEd25519KeyPair("ca");
    const user = generateEd25519KeyPair("alice");
    const now = Math.floor(Date.now() / 1000);
    const certificate = signUserCertificate({
        caPrivateKey: ca.privateKey,
        rawPublic: user.rawPublic,
        keyId: "alice@example",
        principals: ["alice", "admin"],
        serial: 42,
        validAfter: now - 30,
        validBefore: now + 300,
        sourceAddress: "10.1.0.0/24",
    });

    const described = describeCertificate(certificate);
    assert.equal(described.signatureValid, true);
    assert.equal(described.serial, "42");
    assert.equal(described.keyId, "alice@example");
    assert.deepEqual(described.principals, ["alice", "admin"]);
    assert.equal(described.sourceAddress, "10.1.0.0/24");
    assert.equal(publicKeyFromPrivate(ca.privateKey).split(" ")[1], loadEd25519PrivateKey(ca.privateKey).export({ format: "jwk" }).x ? publicKeyFromPrivate(ca.privateKey).split(" ")[1] : "");

    if (!sshKeygen()) return;
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nexterm-cert-"));
    const certPath = path.join(directory, "id_ed25519-cert.pub");
    fs.writeFileSync(certPath, certificate);
    const inspected = execFileSync("ssh-keygen", ["-L", "-f", certPath], { encoding: "utf8" });
    assert.match(inspected, /alice@example/);
    assert.match(inspected, /alice/);
    assert.match(inspected, /admin/);
    fs.rmSync(directory, { recursive: true, force: true });
});

test("rejects a certificate that is only a public key", () => {
    const pair = generateEd25519KeyPair("user");
    assert.throws(() => normalizeCertificate(pair.publicKey), /OpenSSH user certificate/);
});

test("maps identity groups onto certificate principals", () => {
    assert.deepEqual(resolvePrincipals({
        username: "alice",
        groups: ["/devops", "contractors"],
        groupPrincipalMappings: [{ group: "/devops", principals: ["ubuntu", "alice"] }],
        extraPrincipals: ["ops"],
    }), ["alice", "ubuntu", "ops"]);
    assert.equal(renderKeyId("{{account}}:{{username}}@{{host}}", {
        username: "alice", account: "a.smith", server: "web", host: "10.0.0.8",
    }), "a.smith:alice@10.0.0.8");
    assert.equal(normalizeSourceAddress("10.0.0.8"), "10.0.0.8/32");
    assert.equal(clampTtl(10), 30);
    assert.equal(clampTtl(90000), 86400);
});

test("issues a short-lived certificate through a webhook without returning the private key in metadata", async () => {
    const caKey = generateEd25519KeyPair("ca");
    let seen;
    const fetchImpl = async (_url, options) => {
        seen = JSON.parse(options.body);
        const userPublic = Buffer.from(seen.publicKey.split(" ")[1], "base64");
        const { value: rawPublic } = readPublic(userPublic);
        const certificate = signUserCertificate({
            caPrivateKey: caKey.privateKey,
            rawPublic,
            keyId: seen.keyId,
            principals: seen.principals,
            serial: 7,
            validAfter: Math.floor(Date.parse(seen.validAfter) / 1000),
            validBefore: Math.floor(Date.parse(seen.validBefore) / 1000),
            sourceAddress: seen.sourceAddress,
        });
        return {
            ok: true,
            text: async () => JSON.stringify({ certificate }),
        };
    };

    const issued = await issueForSession({
        ca: {
            id: 4,
            name: "lab",
            enabled: true,
            backend: "webhook",
            ttlSeconds: 120,
            sourceAddress: "192.168.1.20",
            keyIdTemplate: "{{username}}@{{server}}",
            groupPrincipalMappings: [{ group: "linux-admins", principals: ["root"] }],
            extraPrincipals: [],
            config: { url: "https://ca.example/sign" },
        },
        secret: "token",
        identity: { id: 9, name: "Ops", username: "alice" },
        account: { username: "a.smith", oidcGroups: ["linux-admins"] },
        entry: { id: 3, name: "web-1", organizationId: null, config: { ip: "10.0.0.8" } },
        fetchImpl,
    });

    assert.equal(seen.principals.includes("alice"), true);
    assert.equal(seen.principals.includes("root"), true);
    assert.equal(seen.sourceAddress, "192.168.1.20/32");
    assert.equal(seen.ttlSeconds, 120);
    assert.match(issued.privateKey, /BEGIN OPENSSH PRIVATE KEY/);
    assert.equal(JSON.stringify(issued.metadata).includes("PRIVATE"), false);
    assert.equal(issued.metadata.keyId, "alice@web-1");
    assert.equal(describeCertificate(issued.certificate).signatureValid, true);
});

const signWithCa = (caPrivateKey) => {
    const user = generateEd25519KeyPair("alice");
    const now = Math.floor(Date.now() / 1000);
    const certificate = signUserCertificate({
        caPrivateKey,
        rawPublic: user.rawPublic,
        keyId: "alice@example",
        principals: ["alice"],
        serial: 9,
        validAfter: now - 30,
        validBefore: now + 300,
    });
    assert.equal(describeCertificate(certificate).signatureValid, true);
    if (!sshKeygen()) return;
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nexterm-cert-"));
    const certPath = path.join(directory, "id_ed25519-cert.pub");
    fs.writeFileSync(certPath, certificate);
    const inspected = execFileSync("ssh-keygen", ["-L", "-f", certPath], { encoding: "utf8" });
    assert.match(inspected, /alice@example/);
    fs.rmSync(directory, { recursive: true, force: true });
};

test("signs with an ECDSA CA key", () => {
    const { privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    signWithCa(privateKey.export({ type: "pkcs8", format: "pem" }));
});

test("signs with an RSA CA key", () => {
    const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    signWithCa(privateKey.export({ type: "pkcs8", format: "pem" }));
});

test("reads an OpenSSH ECDSA CA key", (t) => {
    if (!sshKeygen()) {
        t.skip("OpenSSH ssh-keygen is not available");
        return;
    }
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nexterm-ca-"));
    const keyPath = path.join(directory, "ca");
    execFileSync("ssh-keygen", ["-q", "-t", "ecdsa", "-b", "256", "-N", "", "-f", keyPath]);
    const material = fs.readFileSync(keyPath, "utf8");
    assert.match(publicKeyFromPrivate(material), /^ecdsa-sha2-nistp256 /);
    signWithCa(material);
    fs.rmSync(directory, { recursive: true, force: true });
});

test("selects an authority from group, domain, and environment and applies the lifetime", () => {
    const account = { oidcGroups: ["linux-admins"] };
    const entry = { organizationId: 2, config: { domain: "corp.example", environment: "production" } };
    const chosen = selectAuthority([
        { id: 1, enabled: true, organizationId: 2, selectorGroups: [], domains: [], environments: [] },
        { id: 2, enabled: true, organizationId: null, selectorGroups: ["linux-admins"], domains: ["corp.example"], environments: ["production"] },
        { id: 3, enabled: true, organizationId: null, selectorGroups: [], domains: [], environments: [] },
    ], { account, entry });
    assert.equal(chosen.id, 2);
    assert.equal(resolveTtl({
        ca: { ttlSeconds: 300, ttlByGroup: [{ group: "linux-admins", ttlSeconds: 900 }], ttlByEnvironment: [{ environment: "production", ttlSeconds: 120 }] },
        account,
        entry,
    }), 900);
    assert.equal(resolveTtl({ ca: { ttlSeconds: 300 }, account, entry: { config: { sshCertTtl: 60 } } }), 60);
});

test("mints a step-ca provisioner token and sends it to the signer", async () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const jwk = privateKey.export({ format: "jwk" });
    jwk.kid = "ops-key";
    const caKey = generateEd25519KeyPair("ca");
    let seen;
    const fetchImpl = async (_url, options) => {
        seen = JSON.parse(options.body);
        const userPublic = Buffer.from(seen.publicKey, "base64");
        const { value: rawPublic } = readPublic(userPublic);
        const certificate = signUserCertificate({
            caPrivateKey: caKey.privateKey,
            rawPublic,
            keyId: seen.keyId,
            principals: seen.principals,
            serial: 11,
            validAfter: Math.floor(Date.parse(seen.validAfter) / 1000),
            validBefore: Math.floor(Date.parse(seen.validBefore) / 1000),
        });
        return { ok: true, text: async () => JSON.stringify({ crt: certificate.split(/\s+/)[1] }) };
    };

    const issued = await issueForSession({
        ca: {
            id: 8,
            name: "step",
            enabled: true,
            backend: "step",
            ttlSeconds: 300,
            keyIdTemplate: "{{subject}}",
            groupPrincipalMappings: [],
            extraPrincipals: [],
            config: { url: "https://ca.example", tokenMode: "provisioner", provisioner: "ops" },
        },
        secret: JSON.stringify(jwk),
        identity: { username: "alice" },
        account: { username: "a.smith", idpSubject: "user-1", oidcGroups: [] },
        entry: { id: 1, name: "web", config: {} },
        fetchImpl,
    });

    const [encodedHeader, payload] = seen.ott.split(".");
    const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString());
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    assert.equal(header.kid, "ops-key");
    assert.equal(claims.iss, "ops");
    assert.match(issued.certificate, /^ssh-ed25519-cert-v01@openssh.com /);
    assert.equal(claims.aud, "https://ca.example/ssh/sign");
    assert.equal(claims.sub, "user-1");
    assert.deepEqual(claims.step.ssh.principals, ["alice"]);
    const token = mintStepSshToken({
        secret: JSON.stringify(jwk),
        config: { url: "https://ca.example", provisioner: "ops" },
        subject: "user-1",
        publicKey: seen.publicKey,
        principals: ["alice"],
        keyId: "user-1",
        validAfter: 1,
        validBefore: 2,
    });
    const [tokenHeader, tokenBody, signature] = token.split(".");
    const verified = crypto.verify(
        "sha256",
        Buffer.from(`${tokenHeader}.${tokenBody}`),
        publicKey,
        (() => {
            const raw = Buffer.from(signature, "base64url");
            const integer = (value) => {
                if (value[0] & 0x80) value = Buffer.concat([Buffer.from([0]), value]);
                return Buffer.concat([Buffer.from([0x02, value.length]), value]);
            };
            const rs = Buffer.concat([integer(raw.subarray(0, 32)), integer(raw.subarray(32))]);
            return Buffer.concat([Buffer.from([0x30, rs.length]), rs]);
        })(),
    );
    assert.equal(verified, true);
    assert.equal(issued.metadata.idpSubject, "user-1");
    assert.equal(issued.metadata.ttlSeconds, 300);
});

const readPublic = (blob) => {
    const length = blob.readUInt32BE(0);
    const next = 4 + length;
    const keyLength = blob.readUInt32BE(next);
    return { value: blob.subarray(next + 4, next + 4 + keyLength) };
};
