const Entry = require("../models/Entry");
const { checkServerStatus } = require("../hooks/status/portHook");
const { checkPVEStatus } = require("../hooks/status/pveHook");
const { getMonitoringSettingsInternal } = require("../controllers/monitoring");
const logger = require("./logger");

let statusCheckInterval = null;
let isRunning = false;
let currentSettings = null;

const DEFAULT_CHECK_INTERVAL = 30000;
const DEFAULT_BATCH_SIZE = 10;

const executeByType = async (entry) => {
    const type = entry.type;

    if (type === "server") {
        return await checkServerStatus(entry);
    } else if (type === "pve-qemu" || type === "pve-lxc" || type === "pve-shell") {
        return await checkPVEStatus(entry);
    }

    return null;
};

const checkEntryWithTimeout = async (entry, timeout) => {
    const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
            resolve({ id: entry.id, status: null });
        }, timeout);
    });

    const checkPromise = executeByType(entry)
        .then(status => ({ id: entry.id, status }))
        .catch(() => ({ id: entry.id, status: null }));

    return Promise.race([checkPromise, timeoutPromise]);
};


const processBatch = async (entries, batchTimeout) => {
    logger.verbose(`Processing status check batch`, { batchSize: entries.length });
    const checks = entries.map(entry => checkEntryWithTimeout(entry, batchTimeout));

    const results = await Promise.all(checks);

    const validResults = results.filter(result => result.status !== null);
    logger.verbose(`Batch processing complete`, { 
        total: results.length, 
        valid: validResults.length, 
        timeout: results.length - validResults.length 
    });

    return validResults;
};

const listAllServers = async () => {
    try {
        const entries = await Entry.findAll({
            where: {
                type: ["server", "pve-qemu", "pve-lxc", "pve-shell"],
            },
            attributes: ["id", "type", "name", "config", "integrationId", "status"],
        });

        return entries;
    } catch (error) {
        logger.error(`Error fetching entries for status check`, { error: error.message });
        return [];
    }
};

const updateStatuses = async (results) => {
    if (results.length === 0) return;

    try {
        logger.verbose(`Updating entry statuses`, { count: results.length });
        await Promise.all(
            results.map(({ id, status }) =>
                Entry.update({ status }, { where: { id } }),
            ),
        );
        logger.debug(`Status updates completed`, { 
            entries: results.map(r => ({ id: r.id, status: r.status })) 
        });

    } catch (error) {
        logger.error(`Error updating entry statuses`, { error: error.message });
    }
}

const runStatusCheck = async () => {
    if (isRunning) {
        logger.debug(`Status check already running, skipping cycle`);
        return;
    }

    isRunning = true;
    
    try {
        currentSettings = await getMonitoringSettingsInternal();
        
        if (!currentSettings || !currentSettings.statusCheckerEnabled) {
            logger.verbose(`Status checker is disabled, setting all entries to online`);
            const entries = await listAllServers();
            if (entries.length > 0) {
                await updateStatuses(entries.map(e => ({ id: e.id, status: "online" })));
            }
            isRunning = false;
            return;
        }
        
        logger.verbose(`Starting status check cycle`);
        
        const entries = await listAllServers();

        if (entries.length === 0) {
            logger.verbose(`No entries to check`);
            isRunning = false;
            return;
        }

        const batchSize = currentSettings.batchSize || DEFAULT_BATCH_SIZE;
        const batchTimeout = (currentSettings.connectionTimeout || 30) * 1000;

        logger.info(`Checking status for ${entries.length} entries`, { 
            batchSize: batchSize, 
            batches: Math.ceil(entries.length / batchSize) 
        });

        const allResults = [];

        for (let i = 0; i < entries.length; i += batchSize) {
            const batch = entries.slice(i, i + batchSize);
            logger.verbose(`Processing batch ${Math.floor(i / batchSize) + 1}`, { 
                entries: batch.map(e => ({ id: e.id, type: e.type, name: e.name })) 
            });

            const batchResults = await processBatch(batch, batchTimeout);
            allResults.push(...batchResults);
        }

        await updateStatuses(allResults);
        logger.info(`Status check cycle completed`, { 
            totalChecked: entries.length, 
            updated: allResults.length 
        });
    } catch (error) {
        logger.error(`Error in status check cycle`, { error: error.message });
    } finally {
        isRunning = false;
    }
}

const startStatusChecker = async (interval = null) => {
    if (statusCheckInterval !== null) {
        logger.warn(`Status checker already running`);
        return;
    }

    currentSettings = await getMonitoringSettingsInternal();
    const checkInterval = interval || (currentSettings?.statusInterval ? currentSettings.statusInterval * 1000 : DEFAULT_CHECK_INTERVAL);

    logger.system(`Starting status checker`, { interval: checkInterval, batchSize: currentSettings?.batchSize || DEFAULT_BATCH_SIZE });

    runStatusCheck();

    statusCheckInterval = setInterval(runStatusCheck, checkInterval);
};

const stopStatusChecker = () => {
    if (statusCheckInterval !== null) {
        logger.system(`Stopping status checker`);
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
    }
};

module.exports = {
    startStatusChecker,
    stopStatusChecker,
};
