const {Sequelize} = require('sequelize');
const logger = require('./logger');

const STORAGE_PATH = `data/nexterm.db`;

Sequelize.DATE.prototype._stringify = function(date) {
    return (date instanceof Date ? date : new Date(date)).toISOString();
};

const getCallerFromStack = () => {
    const originalPrepare = Error.prepareStackTrace;
    Error.prepareStackTrace = (_, stack) => stack;
    const stack = new Error().stack;
    Error.prepareStackTrace = originalPrepare;
    
    for (const frame of stack) {
        const fileName = frame.getFileName();
        if (!fileName || fileName.includes('node_modules') || fileName.includes('database.js') || fileName.includes('internal/')) continue;
        const file = fileName.split('/').slice(-2).join('/');
        const func = frame.getFunctionName();
        return func ? `${file}:${frame.getLineNumber()} ${func}()` : `${file}:${frame.getLineNumber()}`;
    }
    return 'sequelize';
};

if (process.env.DB_TYPE === "mysql") {
    if (!process.env.DB_NAME || !process.env.DB_PASS || !process.env.DB_USER)
        throw new Error("Missing database environment variables");

    module.exports = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
        host: process.env.DB_HOST || "localhost",
        dialect: 'mysql',
        logging: (msg) => logger.baseLogger.debug(msg, { caller: getCallerFromStack() }),
        query: {raw: true}
    });
} else if (!process.env.DB_TYPE || process.env.DB_TYPE === "sqlite") {
    module.exports = new Sequelize({
        dialect: 'sqlite', 
        storage: STORAGE_PATH, 
        logging: (msg) => logger.baseLogger.debug(msg, { caller: getCallerFromStack() }), 
        query: {raw: true}
    });
} else {
    throw new Error("Invalid database type");
}