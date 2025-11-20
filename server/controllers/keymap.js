const Keymap = require("../models/Keymap");

const DEFAULT_KEYMAPS = [
    { action: "search", key: "ctrl+s" },
    { action: "ai-menu", key: "ctrl+k" },
    { action: "snippets", key: "ctrl+shift+s" },
    { action: "keyboard-shortcuts", key: "ctrl+shift+k" },
    { action: "broadcast", key: "ctrl+b" },
    { action: "copy", key: "ctrl+shift+c" },
];

module.exports.getKeymaps = async (accountId) => {
    let keymaps = await Keymap.findAll({ where: { accountId } });

    const existingActions = keymaps.map(k => k.action);
    const missingKeymaps = DEFAULT_KEYMAPS.filter(dk => !existingActions.includes(dk.action));

    if (missingKeymaps.length > 0) {
        await Keymap.bulkCreate(missingKeymaps.map(keymap => ({ ...keymap, accountId, enabled: true })));
        keymaps = await Keymap.findAll({ where: { accountId } });
    }

    return keymaps;
};

module.exports.updateKeymap = async (accountId, action, updates) => {
    const keymap = await Keymap.findOne({ where: { accountId, action } });
    if (!keymap) return { code: 401, message: "Keymap not found" };

    if (updates.key && updates.key !== keymap.key) {
        const conflict = await Keymap.findOne({ where: { accountId, key: updates.key, enabled: true } });
        if (conflict && conflict.action !== action) {
            return { code: 402, message: `Key combination already in use by action: ${conflict.action}` };
        }
    }

    await Keymap.update(updates, { where: { accountId, action } });
    return null;
};

module.exports.resetKeymaps = async (accountId) => {
    await Keymap.destroy({ where: { accountId } });
    await Keymap.bulkCreate(DEFAULT_KEYMAPS.map(keymap => ({ ...keymap, accountId, enabled: true })));
};

module.exports.resetKeymap = async (accountId, action) => {
    const defaultKeymap = DEFAULT_KEYMAPS.find(k => k.action === action);
    if (!defaultKeymap) return { code: 403, message: "Invalid action" };

    const keymap = await Keymap.findOne({ where: { accountId, action } });
    if (!keymap) return { code: 401, message: "Keymap not found" };

    await Keymap.update({ key: defaultKeymap.key, enabled: true }, { where: { accountId, action } });
    return null;
};
