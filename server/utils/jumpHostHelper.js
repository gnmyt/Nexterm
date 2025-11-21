const sshd = require("ssh2");
const { getIdentityCredentials } = require("../controllers/identity");
const Entry = require("../models/Entry");
const EntryIdentity = require("../models/EntryIdentity");
const Identity = require("../models/Identity");

const buildSSHOptions = (identity, credentials, entryConfig) => ({
    host: entryConfig.ip,
    port: entryConfig.port,
    username: identity.username,
    tryKeyboard: true,
    ...(identity.type === "password"
            ? { password: credentials.password }
            : { privateKey: credentials["ssh-key"], passphrase: credentials.passphrase }
    ),
});

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

const establishJumpHosts = async (jumpHostIds) => {
    const connections = [];

    try {
        for (let i = 0; i < jumpHostIds.length; i++) {
            const jumpEntry = await Entry.findByPk(jumpHostIds[i]);
            if (!jumpEntry || jumpEntry.config?.protocol !== "ssh") {
                throw new Error(`Jump host ${jumpHostIds[i]} not found or is not an SSH server`);
            }

            const jumpEntryIdentity = await EntryIdentity.findOne({
                where: { entryId: jumpEntry.id },
                order: [["isDefault", "DESC"]],
            });

            if (!jumpEntryIdentity) throw new Error(`No identity configured for jump host ${jumpEntry.name}`);

            const jumpIdentity = await Identity.findByPk(jumpEntryIdentity.identityId);
            const jumpCredentials = await getIdentityCredentials(jumpIdentity.id);

            const jumpSsh = new sshd.Client();
            const jumpOptions = {
                host: jumpEntry.config.ip,
                port: jumpEntry.config.port,
                username: jumpIdentity.username,
                ...(jumpIdentity.type === "password"
                        ? { password: jumpCredentials.password }
                        : { privateKey: jumpCredentials["ssh-key"], passphrase: jumpCredentials.passphrase }
                ),
            };

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
