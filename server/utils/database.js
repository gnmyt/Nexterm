const {Sequelize} = require('sequelize');

const STORAGE_PATH = `data/nexterm.db`;

Sequelize.DATE.prototype._stringify = () => {
    return new Date().toISOString();
}

if (process.env.DB_TYPE === "mysql") {
    if (!process.env.DB_NAME || !process.env.DB_PASS || !process.env.DB_USER)
        throw new Error("Missing database environment variables");

    module.exports = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
        host: process.env.DB_HOST || "localhost",
        dialect: 'mysql',
        logging: false,
        query: {raw: true}
    });
} else if (!process.env.DB_TYPE || process.env.DB_TYPE === "sqlite") {
    module.exports = new Sequelize({dialect: 'sqlite', storage: STORAGE_PATH, logging: false, query: {raw: true}});
} else {
    throw new Error("Invalid database type");
}