const winston = require('winston');
const path = require('path');
const fs = require('fs');

const LOG_DIR = path.join(process.cwd(), 'data', 'logs');
const LOG_LEVEL = process.env.LOG_LEVEL || 'system';

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const getCurrentLogFile = () => path.join(LOG_DIR, `${new Date().toISOString().split('T')[0]}.log`);

const cleanOldLogs = () => {
    const maxAge = 14 * 24 * 60 * 60 * 1000;
    try {
        fs.readdirSync(LOG_DIR).forEach(file => {
            if (!file.endsWith('.log') && !file.endsWith('.log.gz')) return;
            const filePath = path.join(LOG_DIR, file);
            if (Date.now() - fs.statSync(filePath).mtime.getTime() > maxAge) fs.unlinkSync(filePath);
        });
    } catch {}
};

setInterval(cleanOldLogs, 24 * 60 * 60 * 1000);
cleanOldLogs();

winston.addColors({
    error: 'red',
    warn: 'yellow',
    system: 'green',
    info: 'blue',
    verbose: 'cyan',
    debug: 'magenta'
});

const getCallerInfo = () => {
    const originalPrepareStackTrace = Error.prepareStackTrace;
    Error.prepareStackTrace = (_, stack) => stack;
    const stack = new Error().stack;
    Error.prepareStackTrace = originalPrepareStackTrace;
    
    for (const frame of stack) {
        const fileName = frame.getFileName();
        if (!fileName || fileName.includes('node_modules') || fileName.includes('logger.js') || fileName.includes('internal/')) continue;
        
        const file = fileName.split('/').slice(-2).join('/');
        const funcName = frame.getFunctionName();
        return funcName ? `${file}:${frame.getLineNumber()} ${funcName}()` : `${file}:${frame.getLineNumber()}`;
    }
    return '';
};

const formatLog = (timestamp, level, message, caller, meta) => {
    const filteredMeta = { ...meta };
    delete filteredMeta.caller;
    
    const metaStr = Object.keys(filteredMeta).length > 0
        ? ' ' + Object.entries(filteredMeta)
            .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
            .join(' ')
        : '';
    
    return `${timestamp} [${level}]${caller ? ` [${caller}]` : ''} ${message}${metaStr}`;
};

const baseLogger = winston.createLogger({
    levels: { error: 0, warn: 1, system: 2, info: 3, verbose: 4, debug: 5 },
    level: LOG_LEVEL,
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message, stack, caller, ...meta }) => 
            formatLog(timestamp, level.toUpperCase(), message, caller, meta) + (stack ? `\n${stack}` : '')
        )
    ),
    transports: [
        new winston.transports.File({ filename: getCurrentLogFile(), maxsize: 20 * 1024 * 1024, level: LOG_LEVEL }),
        new winston.transports.Console({
            level: LOG_LEVEL,
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                winston.format.printf(({ timestamp, level, message, caller, ...meta }) => 
                    formatLog(timestamp, level, message, caller, meta)
                )
            )
        })
    ],
    exitOnError: false
});

const logger = {};
['error', 'warn', 'system', 'info', 'verbose', 'debug'].forEach(level => {
    logger[level] = (message, meta = {}) => baseLogger[level](message, { ...meta, caller: getCallerInfo() });
});

logger.baseLogger = baseLogger;

module.exports = logger;
