const crypto = require("crypto");
const algorithm = "aes-256-gcm";

const getEncryptionKey = () => {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
        throw new Error("ENCRYPTION_KEY not found in environment variables");
    }
    return key;
};

const encrypt = (text) => {
    if (!text) return null;

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
        algorithm,
        Buffer.from(getEncryptionKey(), "hex"),
        iv
    );

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    return {
        encrypted: encrypted,
        iv: iv.toString("hex"),
        authTag: authTag.toString("hex"),
    };
};

const decrypt = (encrypted, iv, authTag) => {
    if (!encrypted || !iv || !authTag) return null;

    const encryptedHex = Buffer.isBuffer(encrypted) ? encrypted.toString('hex') : encrypted;

    const decipher = crypto.createDecipheriv(
        algorithm,
        Buffer.from(getEncryptionKey(), "hex"),
        Buffer.from(iv, "hex")
    );

    decipher.setAuthTag(Buffer.from(authTag, "hex"));

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
};

const encryptConfigPassword = (config) => {
    if (!config?.password) return config;
    const encrypted = encrypt(config.password);
    return {
        ...config,
        password: undefined,
        passwordEncrypted: encrypted.encrypted,
        passwordIV: encrypted.iv,
        passwordAuthTag: encrypted.authTag,
    };
};

const decryptConfigPassword = (config) => {
    if (!config?.passwordEncrypted) return config;
    try {
        const password = decrypt(config.passwordEncrypted, config.passwordIV, config.passwordAuthTag);
        return { ...config, password };
    } catch {
        return config;
    }
};

module.exports = { encrypt, decrypt, encryptConfigPassword, decryptConfigPassword };
