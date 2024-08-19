const Folder = require("../models/Folder");

module.exports.createFolder = async (accountId, configuration) => {
    if (configuration.parentId) {
        const parentFolder = await Folder.findByPk(configuration.parentId);
        if (parentFolder === null) {
            return { code: 302, message: "Parent folder does not exist" };
        }
    }

    const folder = await Folder.create({
        name: configuration.name, accountId: accountId,
        parentId: configuration.parentId,
    });

    return folder;
};

module.exports.deleteFolder = async (accountId, folderId) => {
    const folder = await Folder.findOne({ where: { accountId: accountId, id: folderId } });

    if (folder === null) {
        return { code: 301, message: "Folder does not exist" };
    }

    await Folder.destroy({ where: { id: folderId } });
};

module.exports.renameFolder = async (accountId, folderId, name) => {
    const folder = await Folder.findOne({ where: { accountId: accountId, id: folderId } });

    if (folder === null) {
        return { code: 301, message: "Folder does not exist" };
    }

    await Folder.update({ name: name }, { where: { id: folderId } });
};

module.exports.listFolders = async (accountId) => {
    const folders = await Folder.findAll({
        where: {
            accountId: accountId,
        },
    });

    const folderMap = new Map();
    let newFolders = [];

    folders.forEach(folder => {
        folderMap.set(folder.id, {
            id: folder.id,
            name: folder.name,
            entries: [],
        });
    });

    folders.forEach(folder => {
        if (folder.parentId) {
            const parentFolder = folderMap.get(folder.parentId);
            if (parentFolder) {
                parentFolder.entries.push(folderMap.get(folder.id));
            }
        } else {
            newFolders.push(folderMap.get(folder.id));
        }
    });

    return newFolders;
};
