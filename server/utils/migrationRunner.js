const fs = require('fs');
const path = require('path');
const { DataTypes } = require('sequelize');
const db = require('./database');
const logger = require('./logger');

class MigrationRunner {
    constructor() {
        this.migrationDir = path.join(__dirname, '../migrations');
        this.queryInterface = db.getQueryInterface();
        this.sequelize = db;
    }

    async ensureMigrationTable() {
        const tableExists = await this.queryInterface.showAllTables().then(tables => tables.includes('SequelizeMeta'));
        
        if (!tableExists) {
            await this.queryInterface.createTable('SequelizeMeta', {
                name: {
                    type: DataTypes.STRING,
                    allowNull: false,
                    primaryKey: true
                }
            });
            logger.info('Created SequelizeMeta table for tracking migrations');
        }
    }

    async getExecutedMigrations() {
        try {
            const result = await this.sequelize.query(
                'SELECT name FROM SequelizeMeta ORDER BY name ASC',
                { type: this.sequelize.QueryTypes.SELECT }
            );
            return result.map(row => row.name);
        } catch (error) {
            return [];
        }
    }

    async recordMigration(migrationName) {
        await this.sequelize.query(
            'INSERT INTO SequelizeMeta (name) VALUES (?)',
            { replacements: [migrationName] }
        );
    }

    async getMigrationFiles() {
        if (!fs.existsSync(this.migrationDir)) return [];

        return fs.readdirSync(this.migrationDir).filter(file => file.endsWith('.js')).sort();
    }

    async runMigrations() {
        logger.info('Starting migration process');
        
        await this.ensureMigrationTable();
        
        const migrationFiles = await this.getMigrationFiles();
        const executedMigrations = await this.getExecutedMigrations();
        
        const pendingMigrations = migrationFiles.filter(file => !executedMigrations.includes(file));

        if (pendingMigrations.length === 0) {
            logger.info('No pending migrations found');
            return;
        }

        logger.info(`Found ${pendingMigrations.length} pending migrations`);
        
        for (const migrationFile of pendingMigrations) {
            const migrationPath = path.join(this.migrationDir, migrationFile);
            
            try {
                logger.info(`Running migration`, { file: migrationFile });
                
                const migration = require(migrationPath);
                
                if (typeof migration.up !== 'function') {
                    throw new Error(`Migration ${migrationFile} must export an 'up' function`);
                }
                
                await migration.up(this.queryInterface, DataTypes);
                await this.recordMigration(migrationFile);
                
                logger.info(`Migration completed`, { file: migrationFile });
                
            } catch (error) {
                logger.error(`Migration failed`, { file: migrationFile, error: error.message });
                throw error;
            }
        }
        
        logger.info('All migrations completed successfully');
    }
}

module.exports = MigrationRunner;