const { DataTypes } = require("sequelize");

module.exports = {
    async up(queryInterface) {
        const tableNames = await queryInterface.showAllTables();

        if (!tableNames.includes("accounts")) {
            await queryInterface.createTable("accounts", {
                id: {
                    type: DataTypes.INTEGER,
                    autoIncrement: true,
                    primaryKey: true,
                    allowNull: false,
                },
                firstName: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                lastName: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                username: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                password: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                totpEnabled: {
                    type: DataTypes.BOOLEAN,
                    defaultValue: false,
                },
                role: {
                    type: DataTypes.STRING,
                    defaultValue: "user",
                },
                totpSecret: {
                    type: DataTypes.STRING,
                    allowNull: true,
                },
            });
            console.log("Created accounts table");
        }

        if (!tableNames.includes("organizations")) {
            await queryInterface.createTable("organizations", {
                id: {
                    type: DataTypes.INTEGER,
                    autoIncrement: true,
                    primaryKey: true,
                    allowNull: false,
                },
                name: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                description: {
                    type: DataTypes.STRING,
                    allowNull: true,
                },
                ownerId: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                },
                createdAt: {
                    type: DataTypes.DATE,
                    allowNull: false,
                    defaultValue: DataTypes.NOW,
                },
                updatedAt: {
                    type: DataTypes.DATE,
                    allowNull: false,
                    defaultValue: DataTypes.NOW,
                },
            });
            console.log("Created organizations table");
        }

        if (!tableNames.includes("organization_members")) {
            await queryInterface.createTable("organization_members", {
                organizationId: {
                    type: DataTypes.INTEGER,
                    primaryKey: true,
                    allowNull: false,
                },
                accountId: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                },
                role: {
                    type: DataTypes.ENUM("owner", "member"),
                    defaultValue: "member",
                    allowNull: false,
                },
                status: {
                    type: DataTypes.ENUM("pending", "active"),
                    defaultValue: "pending",
                    allowNull: false,
                },
                invitedBy: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                },
                createdAt: {
                    type: DataTypes.DATE,
                    allowNull: false,
                    defaultValue: DataTypes.NOW,
                },
                updatedAt: {
                    type: DataTypes.DATE,
                    allowNull: false,
                    defaultValue: DataTypes.NOW,
                },
            });
            console.log("Created organization_members table");
        }

        if (!tableNames.includes("folders")) {
            await queryInterface.createTable("folders", {
                id: {
                    type: DataTypes.INTEGER,
                    autoIncrement: true,
                    primaryKey: true,
                    allowNull: false,
                },
                name: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                accountId: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                },
                parentId: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                },
            });
            console.log("Created folders table");
        }

        if (!tableNames.includes("identities")) {
            await queryInterface.createTable("identities", {
                id: {
                    type: DataTypes.INTEGER,
                    autoIncrement: true,
                    primaryKey: true,
                    allowNull: false,
                },
                name: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                accountId: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                },
                username: {
                    type: DataTypes.STRING,
                    allowNull: true,
                },
                type: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                password: {
                    type: DataTypes.STRING,
                    allowNull: true,
                },
                sshKey: {
                    type: DataTypes.TEXT,
                    allowNull: true,
                },
                passphrase: {
                    type: DataTypes.STRING,
                    allowNull: true,
                },
            });
            console.log("Created identities table");
        }

        if (!tableNames.includes("servers")) {
            await queryInterface.createTable("servers", {
                id: {
                    type: DataTypes.INTEGER,
                    autoIncrement: true,
                    primaryKey: true,
                    allowNull: false,
                },
                name: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                accountId: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                },
                folderId: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                },
                icon: {
                    type: DataTypes.STRING,
                    allowNull: true,
                },
                protocol: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                ip: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                port: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                },
                identities: {
                    type: DataTypes.JSON,
                    defaultValue: [],
                },
            });
            console.log("Created servers table");
        }

        if (!tableNames.includes("pve_servers")) {
            await queryInterface.createTable("pve_servers", {
                id: {
                    type: DataTypes.INTEGER,
                    autoIncrement: true,
                    primaryKey: true,
                    allowNull: false,
                },
                name: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                accountId: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                },
                folderId: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                },
                ip: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                port: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                },
                username: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                password: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                online: {
                    type: DataTypes.BOOLEAN,
                    defaultValue: false,
                },
                resources: {
                    type: DataTypes.JSON,
                    defaultValue: [],
                },
            });
            console.log("Created pve_servers table");
        }

        if (!tableNames.includes("sessions")) {
            await queryInterface.createTable("sessions", {
                id: {
                    type: DataTypes.INTEGER,
                    autoIncrement: true,
                    primaryKey: true,
                    allowNull: false,
                },
                accountId: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                },
                token: {
                    type: DataTypes.STRING,
                    allowNull: true,
                },
                ip: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                userAgent: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                lastActivity: {
                    type: DataTypes.DATE,
                    defaultValue: DataTypes.NOW,
                },
            });
            console.log("Created sessions table");
        }

        if (!tableNames.includes("snippets")) {
            await queryInterface.createTable("snippets", {
                id: {
                    type: DataTypes.INTEGER,
                    autoIncrement: true,
                    primaryKey: true,
                    allowNull: false,
                },
                name: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                accountId: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                },
                command: {
                    type: DataTypes.TEXT,
                    allowNull: false,
                },
                description: {
                    type: DataTypes.TEXT,
                    allowNull: true,
                },
            });
            console.log("Created snippets table");
        }

        if (!tableNames.includes("app_sources")) {
            await queryInterface.createTable("app_sources", {
                name: {
                    type: DataTypes.STRING,
                    allowNull: false,
                    primaryKey: true,
                },
                url: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
            });
            console.log("Created app_sources table");
        }

        if (!tableNames.includes("ai_settings")) {
            await queryInterface.createTable("ai_settings", {
                id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                },
                enabled: {
                    type: DataTypes.BOOLEAN,
                    defaultValue: false,
                    allowNull: false,
                },
                provider: {
                    type: DataTypes.ENUM("ollama", "openai"),
                    allowNull: true,
                },
                model: {
                    type: DataTypes.STRING,
                    allowNull: true,
                },
                apiKey: {
                    type: DataTypes.TEXT,
                    allowNull: true,
                },
                apiUrl: {
                    type: DataTypes.STRING,
                    allowNull: true,
                },
                createdAt: {
                    type: DataTypes.DATE,
                    defaultValue: DataTypes.NOW,
                },
                updatedAt: {
                    type: DataTypes.DATE,
                    defaultValue: DataTypes.NOW,
                },
            });
            console.log("Created ai_settings table");
        }

        if (!tableNames.includes("server_monitoring")) {
            await queryInterface.createTable("server_monitoring", {
                id: {
                    type: DataTypes.INTEGER,
                    autoIncrement: true,
                    primaryKey: true,
                    allowNull: false,
                },
                serverId: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                },
                timestamp: {
                    type: DataTypes.DATE,
                    defaultValue: DataTypes.NOW,
                    allowNull: false,
                },
                status: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                cpuUsage: {
                    type: DataTypes.FLOAT,
                    allowNull: true,
                },
                memoryUsage: {
                    type: DataTypes.FLOAT,
                    allowNull: true,
                },
                memoryTotal: {
                    type: DataTypes.BIGINT,
                    allowNull: true,
                },
                diskUsage: {
                    type: DataTypes.JSON,
                    allowNull: true,
                },
                uptime: {
                    type: DataTypes.BIGINT,
                    allowNull: true,
                },
                loadAverage: {
                    type: DataTypes.JSON,
                    allowNull: true,
                },
                networkInterfaces: {
                    type: DataTypes.JSON,
                    allowNull: true,
                },
                processes: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                },
                osInfo: {
                    type: DataTypes.JSON,
                    allowNull: true,
                },
                errorMessage: {
                    type: DataTypes.TEXT,
                    allowNull: true,
                },
            });

            await queryInterface.addIndex("server_monitoring", ["serverId", "timestamp"]);
            console.log("Created server_monitoring table with indexes");
        }

        if (!tableNames.includes("oidc_providers")) {
            await queryInterface.createTable("oidc_providers", {
                id: {
                    type: DataTypes.INTEGER,
                    autoIncrement: true,
                    allowNull: false,
                    primaryKey: true,
                },
                name: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                issuer: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                clientId: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                clientSecret: {
                    type: DataTypes.STRING,
                    allowNull: true,
                },
                clientSecretIV: {
                    type: DataTypes.STRING,
                    allowNull: true,
                },
                clientSecretAuthTag: {
                    type: DataTypes.STRING,
                    allowNull: true,
                },
                redirectUri: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                scope: {
                    type: DataTypes.STRING,
                    allowNull: false,
                    defaultValue: "openid profile email",
                },
                enabled: {
                    type: DataTypes.BOOLEAN,
                    allowNull: false,
                    defaultValue: false,
                },
                emailAttribute: {
                    type: DataTypes.STRING,
                    allowNull: true,
                    defaultValue: "email",
                },
                firstNameAttribute: {
                    type: DataTypes.STRING,
                    allowNull: true,
                    defaultValue: "given_name",
                },
                lastNameAttribute: {
                    type: DataTypes.STRING,
                    allowNull: true,
                    defaultValue: "family_name",
                },
                usernameAttribute: {
                    type: DataTypes.STRING,
                    allowNull: true,
                    defaultValue: "preferred_username",
                },
            });
            console.log("Created oidc_providers table");
        }
    },
};
