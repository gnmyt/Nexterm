const Theme = require("../models/Theme");

module.exports.listThemes = async (accountId) => {
    return await Theme.findAll({
        where: {},
        order: [["name", "ASC"]],
        attributes: ["id", "name", "description", "accountId", "sourceId", "createdAt"],
    });
};

module.exports.getTheme = async (themeId) => {
    const theme = await Theme.findByPk(themeId);
    if (!theme) return { code: 404, message: "Theme not found" };
    return theme;
};

module.exports.getThemeCSS = async (themeId) => {
    const theme = await Theme.findByPk(themeId, { attributes: ["id", "css"] });
    if (!theme) return { code: 404, message: "Theme not found" };
    return theme;
};

module.exports.createTheme = async (themeData, accountId) => {
    const { name, css, description } = themeData;
    return await Theme.create({ name, css, description: description || null, accountId, sourceId: null });
};

module.exports.updateTheme = async (themeId, accountId, updates) => {
    const theme = await Theme.findByPk(themeId);
    if (!theme) return { code: 404, message: "Theme not found" };
    if (theme.sourceId) return { code: 403, message: "Cannot edit source themes" };
    if (theme.accountId !== accountId) return { code: 403, message: "Not authorized" };

    const updateData = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.css !== undefined) updateData.css = updates.css;
    if (updates.description !== undefined) updateData.description = updates.description;

    await Theme.update(updateData, { where: { id: themeId } });
    return await Theme.findByPk(themeId);
};

module.exports.deleteTheme = async (themeId, accountId) => {
    const theme = await Theme.findByPk(themeId);
    if (!theme) return { code: 404, message: "Theme not found" };
    if (theme.sourceId) return { code: 403, message: "Cannot delete source themes" };
    if (theme.accountId !== accountId) return { code: 403, message: "Not authorized" };

    await Theme.destroy({ where: { id: themeId } });
};

module.exports.setActiveTheme = async (accountId, themeId) => {
    const Account = require("../models/Account");

    if (themeId === null) {
        await Account.update({ activeThemeId: null }, { where: { id: accountId } });
        return { activeThemeId: null };
    }

    const theme = await Theme.findByPk(themeId);
    if (!theme) return { code: 404, message: "Theme not found" };

    await Account.update({ activeThemeId: themeId }, { where: { id: accountId } });
    return { activeThemeId: themeId };
};

module.exports.getActiveThemeCSS = async (accountId) => {
    const Account = require("../models/Account");
    const account = await Account.findByPk(accountId, { attributes: ["activeThemeId"] });
    if (!account || !account.activeThemeId) return null;

    const theme = await Theme.findByPk(account.activeThemeId, { attributes: ["css"] });
    return theme?.css || null;
};
