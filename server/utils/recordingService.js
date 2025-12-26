const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { pipeline } = require("stream/promises");
const { Op } = require("sequelize");
const AuditLog = require("../models/AuditLog");
const Organization = require("../models/Organization");
const logger = require("./logger");

const RECORDINGS_DIR = path.join(__dirname, "../../data/recordings");
const DEFAULT_RETENTION_DAYS = 90;

const ensureRecordingsDir = () => {
    if (!fs.existsSync(RECORDINGS_DIR)) {
        fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
        logger.system("Created recordings directory", { path: RECORDINGS_DIR });
    }
};

const getRecordingPath = (auditLogId, type = "guac", compressed = true) => 
    path.join(RECORDINGS_DIR, `${auditLogId}${compressed ? `.${type}.gz` : `.${type}`}`);

const getGuacdRecordingPath = (auditLogId) => path.join(RECORDINGS_DIR, String(auditLogId));

const compressRecording = async (sourcePath, destPath) => {
    try {
        if (!fs.existsSync(sourcePath)) return false;
        await pipeline(
            fs.createReadStream(sourcePath),
            zlib.createGzip({ level: 6 }),
            fs.createWriteStream(destPath)
        );
        fs.unlinkSync(sourcePath);
        logger.debug("Compressed recording", { source: sourcePath, dest: destPath });
        return true;
    } catch (error) {
        logger.error("Failed to compress recording", { sourcePath, destPath, error: error.message });
        return false;
    }
};

const finalizeGuacRecording = async (auditLogId) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return compressRecording(getGuacdRecordingPath(auditLogId), getRecordingPath(auditLogId, "guac", true));
};

const getRecordingInfo = (auditLogId) => {
    for (const type of ["guac", "cast"]) {
        const p = getRecordingPath(auditLogId, type, true);
        if (fs.existsSync(p)) return { exists: true, type, path: p };
    }
    return { exists: false, type: null, path: null };
};

const deleteRecording = (auditLogId) => {
    [getRecordingPath(auditLogId, "guac", true), getRecordingPath(auditLogId, "cast", true), getGuacdRecordingPath(auditLogId)]
        .forEach(p => { try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (e) { logger.error("Failed to delete recording", { path: p, error: e.message }); } });
};

const parseAuditSettings = (org) => {
    if (!org?.auditSettings) return null;
    return typeof org.auditSettings === "string" ? JSON.parse(org.auditSettings) : org.auditSettings;
};

const getRetentionDays = async (organizationId) => {
    if (!organizationId) return DEFAULT_RETENTION_DAYS;
    try {
        const settings = parseAuditSettings(await Organization.findByPk(organizationId));
        return settings?.recordingRetentionDays || DEFAULT_RETENTION_DAYS;
    } catch (error) {
        logger.error("Failed to get retention days", { organizationId, error: error.message });
        return DEFAULT_RETENTION_DAYS;
    }
};

const isRecordingEnabled = async (organizationId) => {
    if (!organizationId) return false;
    try {
        const settings = parseAuditSettings(await Organization.findByPk(organizationId));
        return settings?.enableSessionRecording === true;
    } catch (error) {
        logger.error("Failed to check recording enabled", { organizationId, error: error.message });
        return false;
    }
};

const cleanupOldRecordings = async () => {
    try {
        const logsWithRecordings = await AuditLog.findAll({
            where: { action: { [Op.in]: ["entry.ssh_connect", "entry.rdp_connect", "entry.vnc_connect", "entry.pve_connect"] } },
            attributes: ["id", "organizationId", "timestamp", "details"]
        });
        
        let deletedCount = 0;
        const now = Date.now();
        
        for (const log of logsWithRecordings) {
            const details = typeof log.details === "string" ? JSON.parse(log.details) : log.details || {};
            if (!details.hasRecording) continue;
            
            const retentionMs = (await getRetentionDays(log.organizationId)) * 86400000;
            if (now - new Date(log.timestamp).getTime() > retentionMs) {
                if (getRecordingInfo(log.id).exists) {
                    deleteRecording(log.id);
                    deletedCount++;
                    await AuditLog.update({ details: { ...details, hasRecording: false, recordingDeletedAt: new Date().toISOString() } }, { where: { id: log.id } });
                }
            }
        }
        
        if (deletedCount > 0) logger.info(`Cleaned up ${deletedCount} old recordings`);
    } catch (error) {
        logger.error("Failed to cleanup old recordings", { error: error.message });
    }
};

const cleanupOrphanedRecordings = async () => {
    try {
        if (!fs.existsSync(RECORDINGS_DIR)) return;
        let cleanedCount = 0;
        
        for (const file of fs.readdirSync(RECORDINGS_DIR)) {
            const match = file.match(/^(\d+)/);
            if (!match) continue;
            
            if (!(await AuditLog.findByPk(parseInt(match[1], 10)))) {
                try { fs.unlinkSync(path.join(RECORDINGS_DIR, file)); cleanedCount++; } 
                catch (e) { logger.error("Failed to delete orphaned recording", { file, error: e.message }); }
            }
        }
        
        if (cleanedCount > 0) logger.info(`Cleaned up ${cleanedCount} orphaned recording files`);
    } catch (error) {
        logger.error("Failed to cleanup orphaned recordings", { error: error.message });
    }
};

const compressUnfinishedRecordings = async () => {
    try {
        if (!fs.existsSync(RECORDINGS_DIR)) return;
        
        for (const file of fs.readdirSync(RECORDINGS_DIR)) {
            if (!/^\d+$/.test(file)) continue;
            
            const rawPath = path.join(RECORDINGS_DIR, file);
            try {
                const fd = fs.openSync(rawPath, 'r');
                const buffer = Buffer.alloc(10);
                fs.readSync(fd, buffer, 0, 10, 0);
                fs.closeSync(fd);
                
                const type = /^\d+\./.test(buffer.toString()) ? "guac" : "cast";
                await compressRecording(rawPath, getRecordingPath(parseInt(file, 10), type, true));
                logger.info(`Compressed unfinished recording`, { auditLogId: file, type });
            } catch (e) {
                logger.error("Failed to process unfinished recording", { file, error: e.message });
            }
        }
    } catch (error) {
        logger.error("Failed to compress unfinished recordings", { error: error.message });
    }
};

let cleanupInterval = null;

const start = () => {
    ensureRecordingsDir();
    setTimeout(async () => {
        await compressUnfinishedRecordings();
        await cleanupOrphanedRecordings();
        await cleanupOldRecordings();
    }, 10000);
    cleanupInterval = setInterval(cleanupOldRecordings, 3600000);
    logger.system("Recording service started");
};

const stop = () => {
    if (cleanupInterval) { clearInterval(cleanupInterval); cleanupInterval = null; }
    logger.system("Recording service stopped");
};

module.exports = {
    RECORDINGS_DIR, ensureRecordingsDir, getRecordingPath, getGuacdRecordingPath,
    compressRecording, finalizeGuacRecording, getRecordingInfo, deleteRecording,
    getRetentionDays, isRecordingEnabled, cleanupOldRecordings, start, stop,
};
