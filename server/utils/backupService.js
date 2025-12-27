const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const decompress = require("decompress");
const BackupSettings = require("../models/BackupSettings");
const { decryptConfigPassword } = require("./encryption");
const { createProvider } = require("./backupProviders");
const logger = require("./logger");

const DATA_DIR = path.join(__dirname, "../../data");
const DB_PATH = path.join(DATA_DIR, "nexterm.db");
const RECORDINGS_DIR = path.join(DATA_DIR, "recordings");
const LOGS_DIR = path.join(DATA_DIR, "logs");
const TEMP_DIR = path.join(DATA_DIR, ".backup-temp");

let scheduleInterval = null;

const getSettings = async () => {
    let settings = await BackupSettings.findOne();
    if (!settings) settings = await BackupSettings.create({});
    return {
        ...settings.dataValues,
        providers: settings.providers.map(p => ({ ...p, config: decryptConfigPassword(p.config) })),
    };
};

const getProvider = async (providerId) => {
    const settings = await getSettings();
    const provider = settings.providers.find(p => p.id === providerId);
    if (!provider) throw new Error("Provider not found");
    return createProvider(provider);
};

const getDirSize = (dir) => {
    if (!fs.existsSync(dir)) return 0;
    let size = 0;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        size += stat.isDirectory() ? getDirSize(filePath) : stat.size;
    }
    return size;
};

module.exports.getStorageStats = () => ({
    database: fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0,
    recordings: getDirSize(RECORDINGS_DIR),
    logs: getDirSize(LOGS_DIR),
});

module.exports.createBackup = async (providerId) => {
    const settings = await getSettings();
    const provider = await getProvider(providerId);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupName = `backup-${timestamp}.tar.gz`;
    const tempPath = path.join(TEMP_DIR, backupName);

    if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

    await new Promise((resolve, reject) => {
        const output = fs.createWriteStream(tempPath);
        const archive = archiver("tar", { gzip: true });

        output.on("close", resolve);
        archive.on("error", reject);
        archive.pipe(output);

        if (settings.includeDatabase && fs.existsSync(DB_PATH)) {
            archive.file(DB_PATH, { name: "nexterm.db" });
        }
        if (settings.includeRecordings && fs.existsSync(RECORDINGS_DIR)) {
            archive.directory(RECORDINGS_DIR, "recordings");
        }
        if (settings.includeLogs && fs.existsSync(LOGS_DIR)) {
            archive.directory(LOGS_DIR, "logs");
        }

        archive.finalize();
    });

    const buffer = fs.readFileSync(tempPath);
    await provider.upload(buffer, backupName);
    fs.unlinkSync(tempPath);

    await module.exports.enforceRetention(providerId);

    logger.info(`Backup created: ${backupName}`);
    return backupName;
};

module.exports.enforceRetention = async (providerId) => {
    const settings = await getSettings();
    const provider = await getProvider(providerId);
    const backups = await provider.list();

    if (backups.length > settings.retention) {
        const toDelete = backups.slice(settings.retention);
        for (const backup of toDelete) {
            await provider.delete(backup.name);
            logger.info(`Deleted old backup: ${backup.name}`);
        }
    }
};

module.exports.listBackups = async (providerId) => {
    const provider = await getProvider(providerId);
    return provider.list();
};

module.exports.restoreBackup = async (providerId, backupName) => {
    const provider = await getProvider(providerId);
    const buffer = await provider.download(backupName);
    const restorePath = path.join(TEMP_DIR, "restore");

    if (fs.existsSync(restorePath)) fs.rmSync(restorePath, { recursive: true });
    fs.mkdirSync(restorePath, { recursive: true });

    const tempFile = path.join(TEMP_DIR, backupName);
    fs.writeFileSync(tempFile, buffer);
    await decompress(tempFile, restorePath);
    fs.unlinkSync(tempFile);

    const restoredDb = path.join(restorePath, "nexterm.db");
    const restoredRecordings = path.join(restorePath, "recordings");
    const restoredLogs = path.join(restorePath, "logs");

    if (fs.existsSync(restoredDb)) {
        fs.copyFileSync(restoredDb, DB_PATH);
    }
    if (fs.existsSync(restoredRecordings)) {
        if (fs.existsSync(RECORDINGS_DIR)) fs.rmSync(RECORDINGS_DIR, { recursive: true });
        fs.renameSync(restoredRecordings, RECORDINGS_DIR);
    }
    if (fs.existsSync(restoredLogs)) {
        if (fs.existsSync(LOGS_DIR)) fs.rmSync(LOGS_DIR, { recursive: true });
        fs.renameSync(restoredLogs, LOGS_DIR);
    }

    fs.rmSync(restorePath, { recursive: true });
    logger.info(`Backup restored: ${backupName}, restarting server...`);

    setTimeout(() => process.exit(0), 500);
};

module.exports.testProvider = async (providerConfig) => {
    const provider = createProvider(providerConfig);
    await provider.test();
    return true;
};

const runScheduledBackups = async () => {
    const settings = await getSettings();
    for (const provider of settings.providers) {
        try {
            await module.exports.createBackup(provider.id);
        } catch (err) {
            logger.error(`Scheduled backup failed for provider ${provider.name}`, { error: err.message });
        }
    }
};

module.exports.start = async () => {
    const settings = await getSettings();
    if (settings.scheduleInterval > 0) {
        const ms = settings.scheduleInterval * 60 * 60 * 1000;
        scheduleInterval = setInterval(runScheduledBackups, ms);
        logger.system(`Backup scheduler started (every ${settings.scheduleInterval}h)`);
    }
};

module.exports.stop = () => {
    if (scheduleInterval) {
        clearInterval(scheduleInterval);
        scheduleInterval = null;
        logger.system("Backup scheduler stopped");
    }
};

module.exports.restart = async () => {
    module.exports.stop();
    await module.exports.start();
};
