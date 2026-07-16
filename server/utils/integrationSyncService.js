const Integration = require("../models/Integration");
const { reconcileIntegration } = require("../controllers/integration");
const { getProvider } = require("../lib/hypervisors");
const logger = require("./logger");

let syncInterval = null;
let isRunning = false;

const DEFAULT_SYNC_INTERVAL = 5 * 60 * 1000;
const INITIAL_DELAY = 15 * 1000;

const runSync = async () => {
    if (isRunning) {
        logger.debug("Integration auto-sync already running, skipping cycle");
        return;
    }

    isRunning = true;

    try {
        const integrations = await Integration.findAll();
        if (integrations.length === 0) return;

        for (const integration of integrations) {
            if (!getProvider(integration.type)) continue;

            try {
                const result = await reconcileIntegration(integration);
                if (result.added || result.removedEntries || result.removedFolders) {
                    logger.info("Integration auto-sync applied changes", { integrationId: integration.id, ...result });
                } else {
                    logger.verbose("Integration auto-sync (no changes)", { integrationId: integration.id });
                }
            } catch (error) {
                logger.error("Integration auto-sync failed", { integrationId: integration.id, error: error.message });
                await Integration.update({ status: "offline" }, { where: { id: integration.id } });
            }
        }
    } catch (error) {
        logger.error("Error in integration auto-sync cycle", { error: error.message });
    } finally {
        isRunning = false;
    }
};

const start = (interval = DEFAULT_SYNC_INTERVAL) => {
    if (syncInterval !== null) {
        logger.warn("Integration auto-sync already running");
        return;
    }

    logger.system("Starting integration auto-sync", { interval });

    setTimeout(runSync, INITIAL_DELAY);
    syncInterval = setInterval(runSync, interval);
};

const stop = () => {
    if (syncInterval !== null) {
        logger.system("Stopping integration auto-sync");
        clearInterval(syncInterval);
        syncInterval = null;
    }
};

module.exports = { start, stop, runSync };
