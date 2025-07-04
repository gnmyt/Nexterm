const fs = require('fs');
const path = require('path');
const { DataTypes } = require('sequelize');
const db = require('./database');

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
            console.log('Created SequelizeMeta table for tracking migrations');
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
        console.log('Starting migration process...');
        
        await this.ensureMigrationTable();
        
        const migrationFiles = await this.getMigrationFiles();
        const executedMigrations = await this.getExecutedMigrations();
        
        const pendingMigrations = migrationFiles.filter(file => !executedMigrations.includes(file));

        if (pendingMigrations.length === 0) {
            console.log('No pending migrations found');
            return;
        }

        console.log(`Found ${pendingMigrations.length} pending migration(s)`);
        
        for (const migrationFile of pendingMigrations) {
            const migrationPath = path.join(this.migrationDir, migrationFile);
            
            try {
                console.log(`Running migration: ${migrationFile}`);
                
                const migration = require(migrationPath);
                
                if (typeof migration.up !== 'function') {
                    throw new Error(`Migration ${migrationFile} must export an 'up' function`);
                }
                
                await migration.up(this.queryInterface, DataTypes);
                await this.recordMigration(migrationFile);
                
                console.log(`Migration ${migrationFile} completed successfully`);
                
            } catch (error) {
                console.error(`Migration ${migrationFile} failed:`, error.message);
                throw error;
            }
        }
        
        console.log('All migrations completed successfully');
    }
}

module.exports = MigrationRunner;