const crypto = require("node:crypto");

const CERT_TYPES = new Set([
    "ssh-ed25519-cert-v01@openssh.com",
    "ssh-rsa-cert-v01@openssh.com",
    "ecdsa-sha2-nistp256-cert-v01@openssh.com",
    "ecdsa-sha2-nistp384-cert-v01@openssh.com",
    "ecdsa-sha2-nistp521-cert-v01@openssh.com",
    "sk-ssh-ed25519-cert-v01@openssh.com",
    "sk-ecdsa-sha2-nistp256-cert-v01@openssh.com",
]);

const DEFAULT_EXTENSIONS = [
    "permit-X11-forwarding",
    "permit-agent-forwarding",
    "permit-port-forwarding",
    "permit-pty",
    "permit-user-rc",
];

const writeUint32 = (value) => {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt32BE(value >>> 0);
    return buffer;
};

const writeUint64 = (value) => {
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64BE(BigInt(value));
    return buffer;
};

const writeString = (value) => {
    const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
    return Buffer.concat([writeUint32(buffer.length), buffer]);
};

const readUint32 = (buffer, offset) => {
    if (offset + 4 > buffer.length) throw new Error("SSH certificate is malformed");
    return { value: buffer.readUInt32BE(offset), next: offset + 4 };
};

const readUint64 = (buffer, offset) => {
    if (offset + 8 > buffer.length) throw new Error("SSH certificate is malformed");
    return { value: buffer.readBigUInt64BE(offset), next: offset + 8 };
};

const readString = (buffer, offset) => {
    const length = readUint32(buffer, offset);
    const start = length.next;
    const end = start + length.value;
    if (end > buffer.length) throw new Error("SSH certificate is malformed");
    return { value: buffer.subarray(start, end), next: end };
};

const wrapBase64 = (buffer) => buffer.toString("base64").replace(/(.{70})/g, "$1\n");

const ed25519PublicBlob = (rawPublic) => Buffer.concat([
    writeString("ssh-ed25519"),
    writeString(rawPublic),
]);

const publicKeyLine = (rawPublic, comment = "nexterm") =>
    `ssh-ed25519 ${ed25519PublicBlob(rawPublic).toString("base64")} ${comment}`;

const keyObjectFromRaw = (seed, rawPublic) => crypto.createPrivateKey({
    key: {
        kty: "OKP",
        crv: "Ed25519",
        d: seed.toString("base64url"),
        x: rawPublic.toString("base64url"),
    },
    format: "jwk",
});

const rawFromKeyObject = (keyObject) => {
    const jwk = keyObject.export({ format: "jwk" });
    if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || !jwk.d || !jwk.x) {
        throw new Error("Only Ed25519 CA keys can sign certificates locally");
    }
    return {
        seed: Buffer.from(jwk.d, "base64url"),
        rawPublic: Buffer.from(jwk.x, "base64url"),
    };
};

const encodeOpenSshPrivateKey = (seed, rawPublic, comment = "nexterm") => {
    const check = crypto.randomBytes(4);
    let secret = Buffer.concat([
        check,
        check,
        writeString("ssh-ed25519"),
        writeString(rawPublic),
        writeString(Buffer.concat([seed, rawPublic])),
        writeString(comment),
    ]);
    let pad = 1;
    while (secret.length % 8 !== 0) {
        secret = Buffer.concat([secret, Buffer.from([pad])]);
        pad += 1;
    }

    const body = Buffer.concat([
        Buffer.from("openssh-key-v1\0"),
        writeString("none"),
        writeString("none"),
        writeString(""),
        writeUint32(1),
        writeString(ed25519PublicBlob(rawPublic)),
        writeString(secret),
    ]);

    return `-----BEGIN OPENSSH PRIVATE KEY-----\n${wrapBase64(body)}\n-----END OPENSSH PRIVATE KEY-----\n`;
};

const parseOpenSshPrivateKey = (material) => {
    const trimmed = String(material || "").trim();
    const match = /-----BEGIN OPENSSH PRIVATE KEY-----([\s\S]+)-----END OPENSSH PRIVATE KEY-----/.exec(trimmed);
    if (!match) return null;

    const body = Buffer.from(match[1].replace(/\s/g, ""), "base64");
    const magic = Buffer.from("openssh-key-v1\0");
    if (!body.subarray(0, magic.length).equals(magic)) {
        throw new Error("SSH CA private key is not an OpenSSH key");
    }

    let offset = magic.length;
    const cipher = readString(body, offset);
    offset = cipher.next;
    const kdf = readString(body, offset);
    offset = kdf.next;
    const kdfOptions = readString(body, offset);
    offset = kdfOptions.next;
    if (cipher.value.toString() !== "none" || kdf.value.toString() !== "none") {
        throw new Error("The CA private key must not have a passphrase");
    }

    const count = readUint32(body, offset);
    offset = count.next;
    if (count.value < 1) throw new Error("SSH CA private key does not contain a key");
    const embeddedPublic = readString(body, offset);
    offset = embeddedPublic.next;
    for (let index = 1; index < count.value; index += 1) {
        offset = readString(body, offset).next;
    }
    const secret = readString(body, offset).value;
    const first = readUint32(secret, 0);
    const second = readUint32(secret, first.next);
    if (first.value !== second.value) throw new Error("SSH CA private key is malformed");

    let secretOffset = second.next;
    const keyType = readString(secret, secretOffset);
    return privateKeyFromOpenSshSecret(keyType.value.toString(), secret, keyType.next, embeddedPublic.value);
};

const unsigned = (value) => {
    const bytes = Buffer.from(value);
    return bytes.length > 1 && bytes[0] === 0x00 ? bytes.subarray(1) : bytes;
};

const mpint = (value) => {
    let bytes = unsigned(value);
    if (!bytes.length) bytes = Buffer.from([0]);
    if (bytes[0] & 0x80) bytes = Buffer.concat([Buffer.from([0x00]), bytes]);
    return writeString(bytes);
};

const b64url = (value) => unsigned(value).toString("base64url");

const CURVES = {
    "nistp256": { name: "P-256", hash: "sha256", size: 32, ssh: "ecdsa-sha2-nistp256" },
    "nistp384": { name: "P-384", hash: "sha384", size: 48, ssh: "ecdsa-sha2-nistp384" },
    "nistp521": { name: "P-521", hash: "sha512", size: 66, ssh: "ecdsa-sha2-nistp521" },
};

const privateKeyFromOpenSshSecret = (keyType, secret, offset, embeddedPublic) => {
    if (keyType === "ssh-ed25519") {
        const rawPublic = readString(secret, offset);
        const rawPrivate = readString(secret, rawPublic.next);
        if (rawPrivate.value.length !== 64) throw new Error("SSH CA private key is malformed");
        const seed = rawPrivate.value.subarray(0, 32);
        if (!rawPrivate.value.subarray(32).equals(rawPublic.value)) throw new Error("SSH CA private key is malformed");
        if (embeddedPublic.length && !embeddedPublic.equals(ed25519PublicBlob(rawPublic.value))) {
            throw new Error("SSH CA private key is malformed");
        }
        return keyObjectFromRaw(seed, rawPublic.value);
    }

    if (keyType.startsWith("ecdsa-sha2-")) {
        const curveName = readString(secret, offset);
        const point = readString(secret, curveName.next);
        const scalar = readString(secret, point.next);
        const curve = CURVES[curveName.value.toString()];
        if (!curve || point.value[0] !== 0x04) throw new Error("SSH CA private key uses an unsupported curve");
        const coordinate = point.value.subarray(1);
        return crypto.createPrivateKey({
            key: {
                kty: "EC",
                crv: curve.name,
                x: coordinate.subarray(0, curve.size).toString("base64url"),
                y: coordinate.subarray(curve.size, curve.size * 2).toString("base64url"),
                d: b64url(scalar.value),
            },
            format: "jwk",
        });
    }

    if (keyType === "ssh-rsa") {
        const modulus = readString(secret, offset);
        const exponent = readString(secret, modulus.next);
        const privateExponent = readString(secret, exponent.next);
        const coefficient = readString(secret, privateExponent.next);
        const prime1 = readString(secret, coefficient.next);
        const prime2 = readString(secret, prime1.next);
        const d = BigInt(`0x${unsigned(privateExponent.value).toString("hex")}`);
        const p = BigInt(`0x${unsigned(prime1.value).toString("hex")}`);
        const q = BigInt(`0x${unsigned(prime2.value).toString("hex")}`);
        const toFixed = (value, length) => Buffer.from(value.toString(16).padStart(length * 2, "0"), "hex");
        return crypto.createPrivateKey({
            key: {
                kty: "RSA",
                n: b64url(modulus.value),
                e: b64url(exponent.value),
                d: b64url(privateExponent.value),
                p: b64url(prime1.value),
                q: b64url(prime2.value),
                dp: b64url(toFixed(d % (p - 1n), unsigned(prime1.value).length)),
                dq: b64url(toFixed(d % (q - 1n), unsigned(prime2.value).length)),
                qi: b64url(coefficient.value),
            },
            format: "jwk",
        });
    }

    throw new Error("The local CA key must be Ed25519, ECDSA, or RSA");
};

const loadCaPrivateKey = (material) => {
    const trimmed = String(material || "").trim();
    if (trimmed.includes("BEGIN OPENSSH PRIVATE KEY")) return parseOpenSshPrivateKey(trimmed);
    try {
        const key = crypto.createPrivateKey(trimmed);
        if (!["ed25519", "ec", "rsa"].includes(key.asymmetricKeyType)) {
            throw new Error("The local CA key must be Ed25519, ECDSA, or RSA");
        }
        if (key.asymmetricKeyType === "ed25519") rawFromKeyObject(key);
        return key;
    } catch (error) {
        if (String(error.message || "").includes("CA key") || String(error.message || "").includes("passphrase")) throw error;
        throw new Error("SSH CA private key could not be read");
    }
};

const loadEd25519PrivateKey = (material) => {
    const key = loadCaPrivateKey(material);
    if (key.asymmetricKeyType !== "ed25519") throw new Error("Only Ed25519 CA keys can sign certificates locally");
    return key;
};

const sshPublicBlob = (key) => {
    const jwk = key.export({ format: "jwk" });
    if (jwk.kty === "OKP" && jwk.crv === "Ed25519") return ed25519PublicBlob(Buffer.from(jwk.x, "base64url"));
    if (jwk.kty === "EC") {
        const curve = Object.values(CURVES).find((item) => item.name === jwk.crv);
        if (!curve) throw new Error("The local CA key must be Ed25519, ECDSA, or RSA");
        const coordinate = (value) => {
            const bytes = Buffer.from(value, "base64url");
            return Buffer.concat([Buffer.alloc(Math.max(0, curve.size - bytes.length)), bytes]);
        };
        const point = Buffer.concat([
            Buffer.from([0x04]),
            coordinate(jwk.x),
            coordinate(jwk.y),
        ]);
        return Buffer.concat([
            writeString(curve.ssh),
            writeString(curve.name.replace("P-", "nistp")),
            writeString(point),
        ]);
    }
    if (jwk.kty === "RSA") {
        if (Buffer.from(jwk.n, "base64url").length < 256) throw new Error("An RSA CA key must be at least 2048 bits");
        return Buffer.concat([
            writeString("ssh-rsa"),
            mpint(Buffer.from(jwk.e, "base64url")),
            mpint(Buffer.from(jwk.n, "base64url")),
        ]);
    }
    throw new Error("The local CA key must be Ed25519, ECDSA, or RSA");
};

const publicKeyFromPrivate = (material) => {
    const key = loadCaPrivateKey(material);
    const blob = sshPublicBlob(key);
    const type = readString(blob, 0).value.toString();
    return `${type} ${blob.toString("base64")} nexterm-ca`;
};

const derToMpints = (der) => {
    let offset = der[1] < 0x80 ? 2 : 2 + (der[1] & 0x7f);
    const readInteger = () => {
        if (der[offset] !== 0x02) throw new Error("SSH CA signature is malformed");
        const length = der[offset + 1];
        const value = der.subarray(offset + 2, offset + 2 + length);
        offset += 2 + length;
        return mpint(value);
    };
    return Buffer.concat([readInteger(), readInteger()]);
};

const sshSignature = (key, body) => {
    if (key.asymmetricKeyType === "ed25519") {
        return Buffer.concat([writeString("ssh-ed25519"), writeString(crypto.sign(null, body, key))]);
    }
    if (key.asymmetricKeyType === "ec") {
        const jwk = key.export({ format: "jwk" });
        const curve = Object.values(CURVES).find((item) => item.name === jwk.crv);
        const signature = crypto.sign(curve.hash, body, key);
        return Buffer.concat([writeString(curve.ssh), writeString(derToMpints(signature))]);
    }
    return Buffer.concat([
        writeString("rsa-sha2-512"),
        writeString(crypto.sign("sha512", body, key)),
    ]);
};

const generateEd25519KeyPair = (comment = "nexterm-session") => {
    const { privateKey } = crypto.generateKeyPairSync("ed25519");
    const { seed, rawPublic } = rawFromKeyObject(privateKey);
    return {
        privateKey: encodeOpenSshPrivateKey(seed, rawPublic, comment),
        publicKey: publicKeyLine(rawPublic, comment),
        rawPublic,
    };
};

const signUserCertificate = ({
    caPrivateKey,
    rawPublic,
    keyId,
    principals,
    serial,
    validAfter,
    validBefore,
    sourceAddress = null,
    extensions = DEFAULT_EXTENSIONS,
}) => {
    const signer = typeof caPrivateKey === "string" ? loadCaPrivateKey(caPrivateKey) : caPrivateKey;
    const caPublicBlob = sshPublicBlob(signer);
    const principalsBlob = Buffer.concat(principals.map((principal) => writeString(principal)));
    const critical = sourceAddress
        ? Buffer.concat([
            writeString("source-address"),
            writeString(writeString(sourceAddress)),
        ])
        : Buffer.alloc(0);
    const extensionBlob = Buffer.concat(extensions.map((name) => Buffer.concat([
        writeString(name),
        writeString(""),
    ])));

    const body = Buffer.concat([
        writeString("ssh-ed25519-cert-v01@openssh.com"),
        writeString(crypto.randomBytes(32)),
        writeString(rawPublic),
        writeUint64(serial),
        writeUint32(1),
        writeString(keyId),
        writeString(principalsBlob),
        writeUint64(validAfter),
        writeUint64(validBefore),
        writeString(critical),
        writeString(extensionBlob),
        writeString(""),
        writeString(caPublicBlob),
    ]);

    const certificate = Buffer.concat([body, writeString(sshSignature(signer, body))]);
    return `ssh-ed25519-cert-v01@openssh.com ${certificate.toString("base64")} ${keyId}`;
};

const certificateLine = (text) => String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#"));

const certificateFromBlob = (blob) => {
    const decoded = Buffer.from(blob, "base64");
    if (!decoded.length) throw new Error("SSH certificate is malformed");
    const type = readString(decoded, 0).value.toString();
    if (!CERT_TYPES.has(type)) throw new Error("SSH certificate is not an OpenSSH user certificate");
    return `${type} ${blob}`;
};

const normalizeCertificate = (text) => {
    const line = certificateLine(text);
    if (!line) throw new Error("SSH certificate is empty");
    const match = /^(\S+)\s+([A-Za-z0-9+/=]+)(?:\s+(\S+))?$/.exec(line);
    if (match && CERT_TYPES.has(match[1])) {
        const decoded = Buffer.from(match[2], "base64");
        if (!decoded.length) throw new Error("SSH certificate is malformed");
        const type = readString(decoded, 0);
        if (type.value.toString() !== match[1]) throw new Error("SSH certificate is malformed");
        return match[3] ? `${match[1]} ${match[2]} ${match[3]}` : `${match[1]} ${match[2]}`;
    }
    if (/^[A-Za-z0-9+/=]+$/.test(line)) return certificateFromBlob(line);
    throw new Error("SSH certificate is not an OpenSSH user certificate");
};

const readNameList = (buffer) => {
    const names = [];
    let offset = 0;
    while (offset < buffer.length) {
        const item = readString(buffer, offset);
        names.push(item.value.toString());
        offset = item.next;
    }
    return names;
};

const readOptionMap = (buffer) => {
    const options = {};
    let offset = 0;
    while (offset < buffer.length) {
        const name = readString(buffer, offset);
        offset = name.next;
        const data = readString(buffer, offset);
        offset = data.next;
        const inner = data.value.length ? readString(data.value, 0).value.toString() : "";
        options[name.value.toString()] = inner;
    }
    return options;
};

const describeCertificate = (text) => {
    const normalized = normalizeCertificate(text);
    if (!normalized.startsWith("ssh-ed25519-cert-v01@openssh.com ")) {
        return { keyId: normalized.split(/\s+/)[2] || null, principals: [], serial: null, signatureValid: null };
    }

    const body = Buffer.from(normalized.split(/\s+/)[1], "base64");
    let offset = 0;
    offset = readString(body, offset).next;
    offset = readString(body, offset).next;
    offset = readString(body, offset).next;
    const serial = readUint64(body, offset);
    offset = serial.next;
    offset = readUint32(body, offset).next;
    const keyId = readString(body, offset);
    offset = keyId.next;
    const principals = readString(body, offset);
    offset = principals.next;
    const validAfter = readUint64(body, offset);
    offset = validAfter.next;
    const validBefore = readUint64(body, offset);
    offset = validBefore.next;
    const critical = readString(body, offset);
    offset = critical.next;
    offset = readString(body, offset).next;
    offset = readString(body, offset).next;
    const signatureKey = readString(body, offset);
    offset = signatureKey.next;
    const signedEnd = offset;
    const signature = readString(body, offset);
    const options = readOptionMap(critical.value);
    let signatureValid = false;
    try {
        signatureValid = verifyCertificateSignature(body.subarray(0, signedEnd), signatureKey.value, signature.value);
    } catch {
        signatureValid = false;
    }

    return {
        serial: serial.value.toString(),
        keyId: keyId.value.toString(),
        principals: readNameList(principals.value),
        validAfter: Number(validAfter.value),
        validBefore: Number(validBefore.value),
        sourceAddress: options["source-address"] || null,
        signatureValid,
    };
};

const mpintToBuffer = (value) => unsigned(value);

const verifyCertificateSignature = (signed, signatureKey, signatureBlob) => {
    const signatureType = readString(signatureBlob, 0);
    const signatureValue = readString(signatureBlob, signatureType.next).value;
    const caType = readString(signatureKey, 0);
    const type = caType.value.toString();
    if (type === "ssh-ed25519" && signatureType.value.toString() === "ssh-ed25519") {
        const raw = readString(signatureKey, caType.next).value;
        const caPublic = crypto.createPublicKey({
            key: { kty: "OKP", crv: "Ed25519", x: raw.toString("base64url") },
            format: "jwk",
        });
        return crypto.verify(null, signed, caPublic, signatureValue);
    }
    if (type === "ssh-rsa" && signatureType.value.toString().startsWith("rsa-sha2-")) {
        const exponent = readString(signatureKey, caType.next);
        const modulus = readString(signatureKey, exponent.next);
        const caPublic = crypto.createPublicKey({
            key: { kty: "RSA", e: b64url(exponent.value), n: b64url(modulus.value) },
            format: "jwk",
        });
        const hash = signatureType.value.toString() === "rsa-sha2-256" ? "sha256" : "sha512";
        return crypto.verify(hash, signed, caPublic, signatureValue);
    }
    if (type.startsWith("ecdsa-sha2-") && signatureType.value.toString() === type) {
        const curveName = readString(signatureKey, caType.next);
        const point = readString(signatureKey, curveName.next);
        const curve = CURVES[curveName.value.toString()];
        if (!curve || point.value[0] !== 0x04) return false;
        const coordinate = point.value.subarray(1);
        const caPublic = crypto.createPublicKey({
            key: {
                kty: "EC",
                crv: curve.name,
                x: coordinate.subarray(0, curve.size).toString("base64url"),
                y: coordinate.subarray(curve.size, curve.size * 2).toString("base64url"),
            },
            format: "jwk",
        });
        let offset = 0;
        const r = readString(signatureValue, offset);
        offset = r.next;
        const s = readString(signatureValue, offset).value;
        const integer = (value) => {
            let bytes = mpintToBuffer(value);
            if (bytes[0] & 0x80) bytes = Buffer.concat([Buffer.from([0x00]), bytes]);
            return Buffer.concat([Buffer.from([0x02, bytes.length]), bytes]);
        };
        const rs = Buffer.concat([integer(r.value), integer(s)]);
        const der = Buffer.concat([Buffer.from([0x30, rs.length]), rs]);
        return crypto.verify(curve.hash, signed, caPublic, der);
    }
    return false;
};

module.exports = {
    DEFAULT_EXTENSIONS,
    generateEd25519KeyPair,
    encodeOpenSshPrivateKey,
    loadEd25519PrivateKey,
    loadCaPrivateKey,
    publicKeyFromPrivate,
    signUserCertificate,
    normalizeCertificate,
    describeCertificate,
};
