const BackupSettings = require("../models/BackupSettings");
const backupService = require("../utils/backupService");
const { encrypt, encryptConfigPassword, decryptConfigPassword } = require("../utils/encryption");
const { v4: uuid } = require("uuid");

const sanitizeProviderForClient = (provider) => ({
    ...provider,
    config: {
        ...provider.config,
        password: undefined,
        passwordEncrypted: undefined,
        passwordIV: undefined,
        passwordAuthTag: undefined,
        hasPassword: !!provider.config?.passwordEncrypted,
    },
});

const getSettings = async () => {
    let settings = await BackupSettings.findOne();
    if (!settings) settings = await BackupSettings.create({});
    return settings;
};

module.exports.getSettings = async () => {
    const settings = await getSettings();
    return {
        providers: settings.providers.map(sanitizeProviderForClient),
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
    const encryptedConfig = encryptConfigPassword(data.config);
    const newProvider = { id: uuid(), type: data.type, name: data.name, config: encryptedConfig };

    const testProvider = { ...newProvider, config: decryptConfigPassword(encryptedConfig) };
    await backupService.testProvider(testProvider);
    providers.push(newProvider);

    await BackupSettings.update({ providers: JSON.stringify(providers) }, { where: { id: settings.id } });
    return sanitizeProviderForClient(newProvider);
};

module.exports.updateProvider = async (providerId, data) => {
    const settings = await getSettings();
    const providers = [...settings.providers];
    const index = providers.findIndex(p => p.id === providerId);
    if (index === -1) return { code: 404, message: "Provider not found" };

    const existing = providers[index];
    let updatedConfig = { ...existing.config };

    if (data.config) {
        const { password, ...otherConfig } = data.config;
        updatedConfig = { ...updatedConfig, ...otherConfig };
        
        if (password) {
            const encrypted = encrypt(password);
            updatedConfig.passwordEncrypted = encrypted.encrypted;
            updatedConfig.passwordIV = encrypted.iv;
            updatedConfig.passwordAuthTag = encrypted.authTag;
        }
    }

    const updated = { ...existing, name: data.name || existing.name, type: data.type || existing.type, config: updatedConfig };

    const testProvider = { ...updated, config: decryptConfigPassword(updatedConfig) };
    await backupService.testProvider(testProvider);
    providers[index] = updated;

    await BackupSettings.update({ providers: JSON.stringify(providers) }, { where: { id: settings.id } });
    return sanitizeProviderForClient(updated);
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
