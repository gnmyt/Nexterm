const BackupSettings = require("../models/BackupSettings");
const backupService = require("../utils/backupService");
const { v4: uuid } = require("uuid");

const getSettings = async () => {
    let settings = await BackupSettings.findOne();
    if (!settings) settings = await BackupSettings.create({});
    return settings;
};

module.exports.getSettings = async () => {
    const settings = await getSettings();
    return {
        providers: settings.providers,
        scheduleInterval: settings.scheduleInterval,
        retention: settings.retention,
        includeDatabase: settings.includeDatabase,
        includeRecordings: settings.includeRecordings,
        includeLogs: settings.includeLogs,
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
    const settings = await getSettings();
    const providers = [...settings.providers];
    const newProvider = { id: uuid(), type: data.type, name: data.name, config: data.config };

    await backupService.testProvider(newProvider);
    providers.push(newProvider);

    await BackupSettings.update({ providers: JSON.stringify(providers) }, { where: { id: settings.id } });
    return newProvider;
};

module.exports.updateProvider = async (providerId, data) => {
    const settings = await getSettings();
    const providers = [...settings.providers];
    const index = providers.findIndex(p => p.id === providerId);
    if (index === -1) return { code: 404, message: "Provider not found" };

    const updated = { ...providers[index], ...data };
    if (data.config) updated.config = { ...providers[index].config, ...data.config };

    await backupService.testProvider(updated);
    providers[index] = updated;

    await BackupSettings.update({ providers: JSON.stringify(providers) }, { where: { id: settings.id } });
    return updated;
};

module.exports.deleteProvider = async (providerId) => {
    const settings = await getSettings();
    const providers = settings.providers.filter(p => p.id !== providerId);
    if (providers.length === settings.providers.length) return { code: 404, message: "Provider not found" };

    await BackupSettings.update({ providers: JSON.stringify(providers) }, { where: { id: settings.id } });
};

module.exports.getStorageStats = () => backupService.getStorageStats();

module.exports.createBackup = async (providerId) => backupService.createBackup(providerId);

module.exports.listBackups = async (providerId) => backupService.listBackups(providerId);

module.exports.restoreBackup = async (providerId, backupName) => backupService.restoreBackup(providerId, backupName);
