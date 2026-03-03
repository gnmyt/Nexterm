const BackupSettings = require("../models/BackupSettings");
const BackupProvider = require("../models/BackupProvider");
const backupService = require("../utils/backupService");
const { v4: uuid } = require("uuid");

const sanitizeProviderForClient = (provider) => ({
    id: provider.id,
    name: provider.name,
    type: provider.type,
    path: provider.path,
    url: provider.url,
    folder: provider.folder,
    username: provider.username,
    share: provider.share,
    domain: provider.domain,
    hasPassword: !!provider.password,
});

const getSettings = async () => {
    let settings = await BackupSettings.findOne({ raw: false });
    if (!settings) settings = await BackupSettings.create({});
    return settings;
};

module.exports.getSettings = async () => {
    const settings = await getSettings();
    const providers = await BackupProvider.findAll();
    return {
        providers: providers.map(sanitizeProviderForClient),
        scheduleInterval: settings.scheduleInterval ?? 0,
        retention: settings.retention ?? 5,
        includeDatabase: settings.includeDatabase ?? true,
        includeRecordings: settings.includeRecordings ?? true,
        includeLogs: settings.includeLogs ?? false,
    };
};

module.exports.updateSettings = async (data) => {
    const settings = await getSettings();
    const { scheduleInterval, retention, includeDatabase, includeRecordings, includeLogs } = data;

    const updates = {};
    if (scheduleInterval !== undefined) updates.scheduleInterval = scheduleInterval;
    if (retention !== undefined) updates.retention = retention;
    if (includeDatabase !== undefined) updates.includeDatabase = includeDatabase;
    if (includeRecordings !== undefined) updates.includeRecordings = includeRecordings;
    if (includeLogs !== undefined) updates.includeLogs = includeLogs;

    await BackupSettings.update(updates, { where: { id: settings.id } });

    if (scheduleInterval !== undefined) await backupService.restart();

    return module.exports.getSettings();
};

module.exports.addProvider = async (data) => {
    const newProvider = {
        id: uuid(),
        type: data.type,
        name: data.name,
        path: data.path,
        url: data.url,
        folder: data.folder,
        username: data.username,
        password: data.password,
        share: data.share,
        domain: data.domain,
    };

    await backupService.testProvider(newProvider);
    const provider = await BackupProvider.create(newProvider);
    return sanitizeProviderForClient(provider);
};

module.exports.updateProvider = async (providerId, data) => {
    const provider = await BackupProvider.findByPk(providerId, { raw: false });
    if (!provider) return { code: 404, message: "Provider not found" };

    const updates = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.type !== undefined) updates.type = data.type;
    if (data.path !== undefined) updates.path = data.path;
    if (data.url !== undefined) updates.url = data.url;
    if (data.folder !== undefined) updates.folder = data.folder;
    if (data.username !== undefined) updates.username = data.username;
    if (data.password) updates.password = data.password;
    if (data.share !== undefined) updates.share = data.share;
    if (data.domain !== undefined) updates.domain = data.domain;

    const testProvider = { ...provider.dataValues, ...updates };
    await backupService.testProvider(testProvider);
    
    await BackupProvider.update(updates, { where: { id: providerId } });
    const updated = await BackupProvider.findByPk(providerId, { raw: false });
    return sanitizeProviderForClient(updated);
};

module.exports.deleteProvider = async (providerId) => {
    const deleted = await BackupProvider.destroy({ where: { id: providerId } });
    if (!deleted) return { code: 404, message: "Provider not found" };
};

module.exports.getStorageStats = () => backupService.getStorageStats();

module.exports.createBackup = async (providerId) => backupService.createBackup(providerId);

module.exports.listBackups = async (providerId) => backupService.listBackups(providerId);

module.exports.restoreBackup = async (providerId, backupName) => backupService.restoreBackup(providerId, backupName);
