const EntryIdentity = require("../models/EntryIdentity");
const Identity = require("../models/Identity");
const { authenticateWebSocket } = require("../middlewares/wsAuth");
const { createSSH } = require("./createSSH");

const authenticateWS = async (ws, req) => {
    const baseAuth = await authenticateWebSocket(ws, req.query);
    if (!baseAuth) return null;

    const { user, entry } = baseAuth;

    const entryIdentities = await EntryIdentity.findAll({ where: { entryId: entry.id }, order: [['isDefault', 'DESC']] });
    if (entryIdentities.length === 0) {
        ws.close(4007, "The entry has no identities");
        return null;
    }

    const identity = await Identity.findByPk(entryIdentities[0].identityId);
    if (!identity) {
        ws.close(4008, "The identity does not exist");
        return null;
    }

    const { ssh, sshOptions } = await createSSH(entry, identity, {
        onKeyboardInteractive: (name, instructions, lang, prompts, finish) => {
            ws.send(`\x02${prompts[0].prompt}`);
            ws.on("message", (data) => {
                if (data.toString().startsWith("\x03")) {
                    const totpCode = data.substring(1);
                    finish([totpCode]);
                }
            });
        }
    });

    try {
        ssh.connect(sshOptions);
    } catch (err) {
        ws.close(4004, err.message);
        return null;
    }

    return { user, server: entry, entry, identity, ssh };
};

module.exports = { authenticateWS };
