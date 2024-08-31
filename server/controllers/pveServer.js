const PVEServer = require("../models/PVEServer");
const Folder = require("../models/Folder");

module.exports.createPVEServer = async (accountId, configuration) => {
    if (configuration.folderId) {
        const folder = await Folder.findOne({ where: { accountId: accountId, id: configuration.folderId } });
        if (folder === null) {
            return { code: 303, message: "Folder does not exist" };
        }
    }

    return await PVEServer.create({
        ...configuration,
        accountId,
    });
};

module.exports.deletePVEServer = async (accountId, serverId) => {
    const server = await PVEServer.findOne({ where: { accountId: accountId, id: serverId } });

    if (server === null) {
        return { code: 401, message: "Server does not exist" };
    }

    await PVEServer.destroy({ where: { id: serverId } });
};

module.exports.editPVEServer = async (accountId, serverId, configuration) => {
    const server = await PVEServer.findOne({ where: { accountId: accountId, id: serverId } });

    if (server === null) {
        return { code: 401, message: "Server does not exist" };
    }

    if (configuration.folderId) {
        const folder = await Folder.findOne({ where: { accountId: accountId, id: configuration.folderId } });
        if (folder === null) {
            return { code: 301, message: "Folder does not exist" };
        }
    }

    await PVEServer.update(configuration, { where: { id: serverId } });
};

module.exports.getPVEServer = async (accountId, serverId) => {
    const server = await PVEServer.findOne({ where: { accountId: accountId, id: serverId } });

    if (server === null) {
        return { code: 401, message: "Server does not exist" };
    }

    return { ...server, token: undefined };
};