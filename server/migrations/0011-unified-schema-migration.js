const { DataTypes } = require("sequelize");
const { encrypt } = require("../utils/encryption");

module.exports = {
    async up(queryInterface) {
        const tableNames = await queryInterface.showAllTables();

        await queryInterface.sequelize.query("PRAGMA foreign_keys = OFF");

        const serverToEntryMap = {};

        if (!tableNames.includes("integrations")) {
            await queryInterface.createTable("integrations", {
                id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
                organizationId: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                    references: { model: "organizations", key: "id" },
                    onDelete: "CASCADE",
                },
                type: { type: DataTypes.STRING, allowNull: false },
                name: { type: DataTypes.STRING, allowNull: false },
                config: { type: DataTypes.JSON, allowNull: true },
                status: { type: DataTypes.STRING, allowNull: true },
                lastSyncAt: { type: DataTypes.DATE, allowNull: true },
                createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
                updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
            });
        }

        if (!tableNames.includes("entries")) {
            await queryInterface.createTable("entries", {
                id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
                organizationId: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                    references: { model: "organizations", key: "id" },
                    onDelete: "CASCADE",
                },
                folderId: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                    references: { model: "folders", key: "id" },
                    onDelete: "SET NULL",
                },
                integrationId: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                    references: { model: "integrations", key: "id" },
                    onDelete: "SET NULL",
                },
                type: { type: DataTypes.STRING, allowNull: false },
                renderer: { type: DataTypes.STRING, allowNull: true },
                name: { type: DataTypes.STRING, allowNull: false },
                icon: { type: DataTypes.STRING, allowNull: true },
                position: { type: DataTypes.INTEGER, defaultValue: 0, allowNull: false },
                status: { type: DataTypes.STRING, allowNull: true },
                config: { type: DataTypes.JSON, allowNull: true },
                createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
                updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
            });
        }

        if (!tableNames.includes("credentials")) {
            await queryInterface.createTable("credentials", {
                id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
                identityId: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                    references: { model: "identities", key: "id" },
                    onDelete: "CASCADE",
                },
                integrationId: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                    references: { model: "integrations", key: "id" },
                    onDelete: "CASCADE",
                },
                serverEntryId: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                    references: { model: "entries", key: "id" },
                    onDelete: "CASCADE",
                },
                type: { type: DataTypes.STRING, allowNull: false },
                secretEncrypted: { type: DataTypes.BLOB, allowNull: false },
                secretIV: { type: DataTypes.STRING, allowNull: true },
                secretAuthTag: { type: DataTypes.STRING, allowNull: true },
                createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
                updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
            });
        }

        if (!tableNames.includes("entries_identities")) {
            await queryInterface.createTable("entries_identities", {
                id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
                entryId: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    references: { model: "entries", key: "id" },
                    onDelete: "CASCADE",
                },
                identityId: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    references: { model: "identities", key: "id" },
                    onDelete: "CASCADE",
                },
                isDefault: { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false },
                createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
            });
        }

        if (!tableNames.includes("monitoring_data")) {
            await queryInterface.createTable("monitoring_data", {
                id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
                entryId: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    references: { model: "entries", key: "id" },
                    onDelete: "CASCADE",
                },
                timestamp: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
                cpuUsage: { type: DataTypes.FLOAT, allowNull: true },
                memoryUsage: { type: DataTypes.FLOAT, allowNull: true },
                memoryTotal: { type: DataTypes.BIGINT, allowNull: true },
                disk: { type: DataTypes.JSON, allowNull: true },
                uptime: { type: DataTypes.BIGINT, allowNull: true },
                loadAverage: { type: DataTypes.JSON, allowNull: true },
                network: { type: DataTypes.JSON, allowNull: true },
                processes: { type: DataTypes.JSON, allowNull: true },
                osInfo: { type: DataTypes.JSON, allowNull: true },
                errorMessage: { type: DataTypes.TEXT, allowNull: true },
            });
            await queryInterface.addIndex("monitoring_data", ["entryId", "timestamp"]);
        }
        if (tableNames.includes("servers")) {
            const servers = await queryInterface.sequelize.query("SELECT * FROM servers",
                { type: queryInterface.sequelize.QueryTypes.SELECT });

            for (const server of servers) {
                let type = "server", renderer = "terminal";
                if (server.protocol === "rdp" || server.protocol === "vnc") renderer = "guac";

                let oldConfig = {};
                if (server.config) {
                    if (typeof server.config === "string") {
                        try {
                            oldConfig = JSON.parse(server.config);
                        } catch (e) {
                            console.error(`Failed to parse config for server ${server.id}:`, e);
                        }
                    } else if (typeof server.config === "object" && !Array.isArray(server.config)) {
                        oldConfig = server.config;
                    }
                }

                const config = {
                    ip: server.ip, port: server.port, protocol: server.protocol,
                    monitoringEnabled: server.monitoringEnabled, ...oldConfig,
                };

                await queryInterface.sequelize.query(
                    `INSERT INTO entries (organizationId, folderId, type, renderer, name, icon, position, config,
                                          createdAt, updatedAt)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                    {
                        replacements: [server.organizationId || null, server.folderId || null, type, renderer,
                            server.name, server.icon || null, server.position || 0, JSON.stringify(config)],
                    },
                );

                const [newEntry] = await queryInterface.sequelize.query("SELECT last_insert_rowid() as id",
                    { type: queryInterface.sequelize.QueryTypes.SELECT });
                serverToEntryMap[server.id] = newEntry.id;

                let identities = [];
                if (server.identities) {
                    if (typeof server.identities === "string") {
                        try {
                            identities = JSON.parse(server.identities);
                        } catch (e) {
                            console.error(`Failed to parse identities for server ${server.id}:`, e);
                        }
                    } else if (Array.isArray(server.identities)) {
                        identities = server.identities;
                    }
                }

                if (Array.isArray(identities) && identities.length > 0) {
                    for (let i = 0; i < identities.length; i++) {
                        if (identities[i]) {
                            await queryInterface.sequelize.query(
                                `INSERT INTO entries_identities (entryId, identityId, isDefault, createdAt)
                                 VALUES (?, ?, ?, datetime('now'))`,
                                { replacements: [newEntry.id, identities[i], i === 0 ? 1 : 0] },
                            );
                        }
                    }
                }
            }
        }

        if (tableNames.includes("pve_servers")) {
            const pveServers = await queryInterface.sequelize.query("SELECT * FROM pve_servers",
                { type: queryInterface.sequelize.QueryTypes.SELECT });

            for (const pveServer of pveServers) {
                const integrationConfig = {
                    ip: pveServer.ip, port: pveServer.port,
                    username: pveServer.username, nodeName: pveServer.nodeName,
                };

                await queryInterface.sequelize.query(
                    `INSERT INTO integrations (organizationId, type, name, config, status, createdAt, updatedAt)
                     VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                    {
                        replacements: [pveServer.organizationId, "proxmox", pveServer.name,
                            JSON.stringify(integrationConfig), pveServer.online ? "online" : "offline"],
                    },
                );

                const [newIntegration] = await queryInterface.sequelize.query("SELECT last_insert_rowid() as id",
                    { type: queryInterface.sequelize.QueryTypes.SELECT });

                const { encrypted, iv, authTag } = encrypt(pveServer.password);
                await queryInterface.sequelize.query(
                    `INSERT INTO credentials (integrationId, type, secretEncrypted, secretIV, secretAuthTag, createdAt,
                                              updatedAt)
                     VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                    { replacements: [newIntegration.id, "password", encrypted, iv, authTag] },
                );

                await queryInterface.sequelize.query(
                    `INSERT INTO folders (organizationId, accountId, parentId, name, position)
                     VALUES (?, ?, ?, ?, ?)`,
                    { replacements: [pveServer.organizationId, pveServer.accountId || null, pveServer.folderId, pveServer.name, 0] },
                );

                const [newFolder] = await queryInterface.sequelize.query("SELECT last_insert_rowid() as id",
                    { type: queryInterface.sequelize.QueryTypes.SELECT });

                let resources = [];
                if (pveServer.resources) {
                    if (typeof pveServer.resources === "string") {
                        try {
                            resources = JSON.parse(pveServer.resources);
                        } catch (e) {
                            console.error(`Failed to parse resources for PVE server ${pveServer.id}:`, e);
                        }
                    } else if (Array.isArray(pveServer.resources)) {
                        resources = pveServer.resources;
                    }
                }

                for (const resource of resources) {
                    if (resource && resource.type && resource.id !== undefined) {
                        const resourceConfig = { nodeName: pveServer.nodeName, vmid: resource.id };
                        let renderer = resource.type === "pve-qemu" ? "guac" : "terminal";

                        await queryInterface.sequelize.query(
                            `INSERT INTO entries (organizationId, folderId, integrationId, type, renderer, name, icon,
                                                  position, status, config, createdAt, updatedAt)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                            {
                                replacements: [pveServer.organizationId, newFolder.id, newIntegration.id, resource.type,
                                    renderer, resource.name, null, 0, resource.status || null, JSON.stringify(resourceConfig)],
                            },
                        );
                    }
                }
            }
        }

        if (tableNames.includes("server_monitoring")) {
            const monitoringRecords = await queryInterface.sequelize.query("SELECT * FROM server_monitoring",
                { type: queryInterface.sequelize.QueryTypes.SELECT });

            for (const record of monitoringRecords) {
                const entryId = serverToEntryMap[record.serverId];
                if (entryId) {
                    await queryInterface.sequelize.query(
                        `INSERT INTO monitoring_data (entryId, timestamp, cpuUsage, memoryUsage, memoryTotal, disk,
                                                      uptime, loadAverage, network, processes, osInfo, errorMessage)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        {
                            replacements: [entryId, record.timestamp, record.cpuUsage, record.memoryUsage, record.memoryTotal,
                                record.diskUsage, record.uptime, record.loadAverage, record.networkInterfaces,
                                record.processes, record.osInfo, record.errorMessage],
                        },
                    );
                }
            }
        }

        if (tableNames.includes("identities")) {
            const identities = await queryInterface.sequelize.query("SELECT * FROM identities",
                { type: queryInterface.sequelize.QueryTypes.SELECT });

            for (const identity of identities) {
                if (identity.password) {
                    await queryInterface.sequelize.query(
                        `INSERT INTO credentials (identityId, type, secretEncrypted, secretIV, secretAuthTag, createdAt,
                                                  updatedAt)
                         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                        { replacements: [identity.id, "password", identity.password, identity.passwordIV, identity.passwordAuthTag] },
                    );
                }
                if (identity.sshKey) {
                    await queryInterface.sequelize.query(
                        `INSERT INTO credentials (identityId, type, secretEncrypted, secretIV, secretAuthTag, createdAt,
                                                  updatedAt)
                         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                        { replacements: [identity.id, "ssh-key", identity.sshKey, identity.sshKeyIV, identity.sshKeyAuthTag] },
                    );
                }
                if (identity.passphrase) {
                    await queryInterface.sequelize.query(
                        `INSERT INTO credentials (identityId, type, secretEncrypted, secretIV, secretAuthTag, createdAt,
                                                  updatedAt)
                         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                        { replacements: [identity.id, "passphrase", identity.passphrase, identity.passphraseIV, identity.passphraseAuthTag] },
                    );
                }
            }
        }

        const identitiesTableInfo = await queryInterface.describeTable("identities");

        if (identitiesTableInfo.password) {
            await queryInterface.removeColumn("identities", "password");
            await queryInterface.removeColumn("identities", "passwordIV");
            await queryInterface.removeColumn("identities", "passwordAuthTag");
        }
        if (identitiesTableInfo.sshKey) {
            await queryInterface.removeColumn("identities", "sshKey");
            await queryInterface.removeColumn("identities", "sshKeyIV");
            await queryInterface.removeColumn("identities", "sshKeyAuthTag");
        }
        if (identitiesTableInfo.passphrase) {
            await queryInterface.removeColumn("identities", "passphrase");
            await queryInterface.removeColumn("identities", "passphraseIV");
            await queryInterface.removeColumn("identities", "passphraseAuthTag");
        }

        if (!identitiesTableInfo.createdAt) {
            await queryInterface.addColumn("identities", "createdAt",
                { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW });
            await queryInterface.sequelize.query("UPDATE identities SET createdAt = datetime('now') WHERE createdAt IS NULL");
        }
        if (!identitiesTableInfo.updatedAt) {
            await queryInterface.addColumn("identities", "updatedAt",
                { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW });
            await queryInterface.sequelize.query("UPDATE identities SET updatedAt = datetime('now') WHERE updatedAt IS NULL");
        }

        await queryInterface.sequelize.query("PRAGMA foreign_keys = ON");

        if (tableNames.includes("servers")) await queryInterface.dropTable("servers");
        if (tableNames.includes("pve_servers")) await queryInterface.dropTable("pve_servers");
        if (tableNames.includes("server_monitoring")) await queryInterface.dropTable("server_monitoring");
    },
};
