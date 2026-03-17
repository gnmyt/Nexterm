const EntryIdentity = require("../models/EntryIdentity");
const Identity = require("../models/Identity");
const { authenticateWebSocket } = require("../middlewares/wsAuth");
const { createSSH } = require("./createSSH");
const { listIdentities } = require("../controllers/identity");

const authenticateWS = async (ws, req) => {
    const baseAuth = await authenticateWebSocket(ws, req.query);
    if (!baseAuth) return null;

    const { user, entry } = baseAuth;

    const accessibleIds = new Set((await listIdentities(user.id)).map(i => i.id));
    const entryIdentities = await EntryIdentity.findAll({ where: { entryId: entry.id }, order: [['isDefault', 'DESC']] });
    
    let identity = null;
    for (const ei of entryIdentities) {
        if (!accessibleIds.has(ei.identityId)) continue;
        identity = await Identity.findByPk(ei.identityId);
        if (identity) break;
    }

    if (!identity) {
        ws.close(4007, "No accessible identity configured");
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
    }, user.id);

    try {
        ssh.connect(sshOptions);
    } catch (err) {
        ws.close(4004, err.message);
        return null;
    }

    return { user, server: entry, entry, identity, ssh };
};

module.exports = { authenticateWS };
