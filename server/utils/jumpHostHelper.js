const crypto = require("crypto");
const sshd = require("ssh2");
const { getIdentityCredentials, listIdentities } = require("../controllers/identity");
const Entry = require("../models/Entry");
const EntryIdentity = require("../models/EntryIdentity");
const Identity = require("../models/Identity");

// Default ssh2 algorithm sets (modern, secure algorithms)
const ssh2Defaults = {
    serverHostKey: ["ssh-ed25519", "ecdsa-sha2-nistp256", "ecdsa-sha2-nistp384", "ecdsa-sha2-nistp521", "rsa-sha2-512", "rsa-sha2-256", "ssh-rsa"],
    kex: ["curve25519-sha256", "curve25519-sha256@libssh.org", "ecdh-sha2-nistp256", "ecdh-sha2-nistp384", "ecdh-sha2-nistp521", "diffie-hellman-group-exchange-sha256", "diffie-hellman-group14-sha256", "diffie-hellman-group15-sha512", "diffie-hellman-group16-sha512", "diffie-hellman-group17-sha512", "diffie-hellman-group18-sha512"],
    cipher: ["chacha20-poly1305@openssh.com", "aes128-gcm", "aes128-gcm@openssh.com", "aes256-gcm", "aes256-gcm@openssh.com", "aes128-ctr", "aes192-ctr", "aes256-ctr"],
    hmac: ["hmac-sha2-256-etm@openssh.com", "hmac-sha2-512-etm@openssh.com", "hmac-sha1-etm@openssh.com", "hmac-sha2-256", "hmac-sha2-512", "hmac-sha1"],
};

// Define everything we want to evaluate for legacy devices
const rawLegacyAlgorithms = {
    serverHostKey: ["ssh-dss"],
    kex: ["diffie-hellman-group1-sha1", "diffie-hellman-group14-sha1", "diffie-hellman-group-exchange-sha1"],
    cipher: ["3des-cbc", "aes128-cbc", "aes192-cbc", "aes256-cbc", "blowfish-cbc", "cast128-cbc", "arcfour", "arcfour128", "arcfour256"],
    hmac: ["hmac-md5", "hmac-md5-96", "hmac-sha1-96", "hmac-sha2-256-96", "hmac-sha2-512-96"],
};

// Map SSH names to OpenSSL names for validation
const sshToOpenSSL = {
    ciphers: { "3des-cbc": "des-ede3-cbc", "aes128-cbc": "aes-128-cbc", "aes192-cbc": "aes-192-cbc", "aes256-cbc": "aes-256-cbc", "blowfish-cbc": "bf-cbc", "cast128-cbc": "cast5-cbc", "arcfour": "rc4", "arcfour128": "rc4", "arcfour256": "rc4" },
    hashes: { "hmac-md5": "md5", "hmac-md5-96": "md5", "hmac-sha1-96": "sha1", "hmac-sha2-256-96": "sha256", "hmac-sha2-512-96": "sha512" }
};

// Dynamically build the safe legacy array based on OS capabilities
const supportedCiphers = crypto.getCiphers();
const supportedHashes = crypto.getHashes();

// Legacy algorithm sets for older SSH devices (e.g. ssh-rsa/ssh-dss, weak kex, CBC ciphers)
const legacyAlgorithms = {
    // Keys and KEX don't rely directly on getCiphers(), so just filter out duplicates
    serverHostKey: rawLegacyAlgorithms.serverHostKey.filter(k => !ssh2Defaults.serverHostKey.includes(k)),
    kex: rawLegacyAlgorithms.kex.filter(k => !ssh2Defaults.kex.includes(k)),

    // Filter ciphers: Must NOT be in modern defaults, AND must be supported by local OpenSSL
    cipher: rawLegacyAlgorithms.cipher.filter(c => {
        if (ssh2Defaults.cipher.includes(c)) return false;
        const osslName = sshToOpenSSL.ciphers[c];
        return osslName && supportedCiphers.includes(osslName);
    }),

    // Filter HMACs: Must NOT be in modern defaults, AND hash must be supported by local OpenSSL
    hmac: rawLegacyAlgorithms.hmac.filter(h => {
        if (ssh2Defaults.hmac.includes(h)) return false;
        const osslName = sshToOpenSSL.hashes[h];
        return osslName && supportedHashes.includes(osslName);
    })
};

const buildSSHOptions = (identity, credentials, entryConfig) => {
    const base = { host: entryConfig.ip, port: entryConfig.port, username: identity.username, tryKeyboard: true };

    // Inject legacy algorithms when enableLegacyCrypto is set, to support older network devices
    if (entryConfig.enableLegacyCrypto) {
        base.algorithms = {
            serverHostKey: [...ssh2Defaults.serverHostKey, ...legacyAlgorithms.serverHostKey],
            kex: [...ssh2Defaults.kex, ...legacyAlgorithms.kex],
            cipher: [...ssh2Defaults.cipher, ...legacyAlgorithms.cipher],
            hmac: [...ssh2Defaults.hmac, ...legacyAlgorithms.hmac],
        };
    }

    if (identity.type === "password" || identity.type === "password-only") {
        return { ...base, password: credentials.password };
    }
    if (identity.type === "both") {
        return {
            ...base,
            privateKey: credentials["ssh-key"],
            passphrase: credentials.passphrase,
            password: credentials.password,
            authHandler: (methodsLeft, partialSuccess, cb) => {
                if (methodsLeft === null) return cb('publickey');
                if (methodsLeft.includes('password') && partialSuccess) return cb('password');
                if (methodsLeft.includes('publickey') && !partialSuccess) return cb('publickey');
                if (methodsLeft.includes('password')) return cb('password');
                if (methodsLeft.includes('keyboard-interactive')) return cb('keyboard-interactive');
                return cb(false);
            }
        };
    }
    return { ...base, privateKey: credentials["ssh-key"], passphrase: credentials.passphrase };
};

const forwardToTarget = async (lastJumpConnection, targetEntry) => {
    return new Promise((resolve, reject) => {
        lastJumpConnection.ssh.forwardOut(
            "127.0.0.1", 0,
            targetEntry.config.ip, targetEntry.config.port,
            (err, stream) => {
                if (err) return reject(new Error(`Port forward to target failed: ${err.message}`));
                resolve(stream);
            },
        );
    });
};

const establishJumpHosts = async (jumpHostIds, accountId = null) => {
    const connections = [];
    const accessibleIds = accountId ? new Set((await listIdentities(accountId)).map(i => i.id)) : null;

    try {
        for (let i = 0; i < jumpHostIds.length; i++) {
            const jumpEntry = await Entry.findByPk(jumpHostIds[i]);
            if (!jumpEntry || jumpEntry.config?.protocol !== "ssh") {
                throw new Error(`Jump host ${jumpHostIds[i]} not found or is not an SSH server`);
            }

            const entryIdentities = await EntryIdentity.findAll({
                where: { entryId: jumpEntry.id },
                order: [["isDefault", "DESC"]],
            });

            let jumpIdentity = null;
            for (const ei of entryIdentities) {
                if (accessibleIds && !accessibleIds.has(ei.identityId)) continue;
                jumpIdentity = await Identity.findByPk(ei.identityId);
                if (jumpIdentity) break;
            }

            if (!jumpIdentity) throw new Error(`No accessible identity for jump host ${jumpEntry.name}`);

            const jumpCredentials = await getIdentityCredentials(jumpIdentity.id);

            const jumpSsh = new sshd.Client();
            const jumpOptions = buildSSHOptions(jumpIdentity, jumpCredentials, jumpEntry.config);

            if (i > 0) {
                await new Promise((resolve, reject) => {
                    connections[i - 1].ssh.forwardOut(
                        "127.0.0.1", 0,
                        jumpEntry.config.ip, jumpEntry.config.port,
                        (err, stream) => {
                            if (err) return reject(new Error(`Port forward failed through ${connections[i - 1].entry.name}: ${err.message}`));
                            jumpOptions.sock = stream;
                            resolve();
                        },
                    );
                });
            }

            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error(`Timeout connecting to ${jumpEntry.name}`)), 30000);
                jumpSsh.once("ready", () => {
                    clearTimeout(timeout);
                    resolve();
                });
                jumpSsh.once("error", (err) => {
                    clearTimeout(timeout);
                    reject(err);
                });
                jumpSsh.connect(jumpOptions);
            });

            connections.push({ ssh: jumpSsh, entry: jumpEntry });
        }

        return connections;
    } catch (error) {
        connections.forEach(conn => conn.ssh.end());
        throw error;
    }
};

module.exports = { establishJumpHosts, buildSSHOptions, forwardToTarget };
