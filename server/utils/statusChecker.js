const Entry = require("../models/Entry");
const { checkServerStatus } = require("../hooks/status/portHook");
const { checkPVEStatus } = require("../hooks/status/pveHook");
const logger = require("./logger");

let statusCheckInterval = null;
let isRunning = false;

const CHECK_INTERVAL = 30000;
const BATCH_SIZE = 10;
const BATCH_TIMEOUT = 5000;

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


const processBatch = async (entries) => {
    const checks = entries.map(entry => checkEntryWithTimeout(entry, BATCH_TIMEOUT));

    const results = await Promise.all(checks);

    return results.filter(result => result.status !== null);
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
        await Promise.all(
            results.map(({ id, status }) =>
                Entry.update({ status }, { where: { id } }),
            ),
        );

    } catch (error) {
        logger.error(`Error updating entry statuses`, { error: error.message });
    }
}

const runStatusCheck = async () => {
    if (isRunning) return;

    isRunning = true;

    try {
        const entries = await listAllServers();

        if (entries.length === 0) {
            isRunning = false;
            return;
        }

        const allResults = [];

        for (let i = 0; i < entries.length; i += BATCH_SIZE) {
            const batch = entries.slice(i, i + BATCH_SIZE);

            const batchResults = await processBatch(batch);
            allResults.push(...batchResults);
        }

        await updateStatuses(allResults);
    } catch (error) {
        logger.error(`Error in status check cycle`, { error: error.message });
    } finally {
        isRunning = false;
    }
}

const startStatusChecker = (interval = CHECK_INTERVAL) => {
    if (statusCheckInterval !== null) {
        return;
    }

    runStatusCheck();

    statusCheckInterval = setInterval(runStatusCheck, interval);
};

const stopStatusChecker = () => {
    if (statusCheckInterval !== null) {
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
    }
};

module.exports = {
    startStatusChecker,
    stopStatusChecker,
};
