const fs = require('fs');
const logger = require('./logger');

const neededFolder = ["data", "data/logs", "data/sources", "data/certs"];

neededFolder.forEach(folder => {
    if (!fs.existsSync(folder)) {
        try {
            fs.mkdirSync(folder, {recursive: true});
        } catch (e) {
            logger.error(`Could not create data folder`, { folder, error: e.message });
            process.exit(0);
        }
    }
});