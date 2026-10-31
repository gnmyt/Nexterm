const { DataTypes, QueryTypes } = require("sequelize");

const INHERITANCE_KEY = "__nextermInheritance";
const SUPPORTED_PROTOCOLS = ["ssh", "telnet", "rdp", "vnc", "sftp", "ftp", "ftps"];
const parseConfig = (value) => {
    if (!value) return {};
    if (typeof value === "object") return value;
    try { return JSON.parse(value); } catch { return {}; }
};

const normalizeLegacyProfiles = (inheritance) => {
    const profiles = Object.fromEntries(Object.entries(inheritance.profiles || {}).map(
        ([protocol, profile]) => [protocol, { ...profile }]
    ));
    if (!inheritance.config || typeof inheritance.config !== "object" || Array.isArray(inheritance.config)) return profiles;
    const { protocol, ...legacyProfile } = inheritance.config;
    for (const profileProtocol of protocol ? [protocol] : SUPPORTED_PROTOCOLS) {
        profiles[profileProtocol] = { ...legacyProfile, ...profiles[profileProtocol] };
    }
    return profiles;
};

module.exports = {
    async up(queryInterface) {
        const sequelize = queryInterface.sequelize;
        await sequelize.transaction(async (transaction) => {
            await queryInterface.createTable("folder_identity_profiles", {
                id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
                folderId: { type: DataTypes.INTEGER, allowNull: false, references: { model: "folders", key: "id" }, onDelete: "CASCADE" },
                protocol: { type: DataTypes.STRING, allowNull: false },
                identityId: { type: DataTypes.INTEGER, allowNull: false, references: { model: "identities", key: "id" }, onDelete: "CASCADE" },
                accountId: { type: DataTypes.INTEGER, allowNull: true, references: { model: "accounts", key: "id" }, onDelete: "CASCADE" },
                position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
                createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
            }, { transaction });
            await queryInterface.addIndex("folder_identity_profiles", ["folderId", "protocol", "identityId"], {
                unique: true,
                name: "folder_identity_profiles_unique_identity",
                transaction,
            });

            const folders = await sequelize.query("SELECT id, accountId, organizationId, config FROM folders", { type: QueryTypes.SELECT, transaction });
            const identities = await sequelize.query("SELECT id, accountId, organizationId FROM identities", { type: QueryTypes.SELECT, transaction });
            const memberships = await sequelize.query("SELECT organizationId, accountId FROM organization_members WHERE status = 'active'", { type: QueryTypes.SELECT, transaction });
            const identitiesById = new Map(identities.map((identity) => [Number(identity.id), identity]));
            const activeMemberships = new Set(memberships.map(
                (membership) => `${Number(membership.organizationId)}:${Number(membership.accountId)}`
            ));
            const rows = new Map();

            for (const folder of folders) {
                const config = parseConfig(folder.config);
                const inheritance = config[INHERITANCE_KEY];
                if (!inheritance) continue;
                const identityProfiles = { ...inheritance.identityProfiles };
                if (Object.hasOwn(inheritance, "identities")) {
                    const legacyProtocols = inheritance.config?.protocol
                        ? [inheritance.config.protocol]
                        : SUPPORTED_PROTOCOLS;
                    legacyProtocols.forEach((protocol) => {
                        if (!Object.hasOwn(identityProfiles, protocol)) identityProfiles[protocol] = inheritance.identities;
                    });
                }

                for (const [protocol, identityIds] of Object.entries(identityProfiles)) {
                    if (!Array.isArray(identityIds)) continue;
                    [...new Set(identityIds.map(Number))].forEach((identityId, position) => {
                        const identity = identitiesById.get(identityId);
                        if (!identity) return;
                        let accountId = null;
                        if (folder.organizationId) {
                            if (Number(identity.organizationId) !== Number(folder.organizationId)) {
                                if (identity.organizationId || !identity.accountId
                                    || !activeMemberships.has(`${Number(folder.organizationId)}:${Number(identity.accountId)}`)) return;
                                accountId = Number(identity.accountId);
                            }
                        } else {
                            if (identity.organizationId || Number(identity.accountId) !== Number(folder.accountId)) return;
                            accountId = Number(folder.accountId);
                        }
                        rows.set(`${Number(folder.id)}:${protocol}:${identityId}`, {
                            folderId: Number(folder.id), protocol, identityId, accountId, position, createdAt: new Date(),
                        });
                    });
                }

                const nextInheritance = { ...inheritance, profiles: normalizeLegacyProfiles(inheritance) };
                nextInheritance.sectionEnabled = { ...nextInheritance.sectionEnabled };
                for (const protocol of Object.keys(identityProfiles)) {
                    const protocolSections = { ...nextInheritance.sectionEnabled[protocol] };
                    if (!Object.hasOwn(protocolSections, "identities")) protocolSections.identities = true;
                    nextInheritance.sectionEnabled[protocol] = protocolSections;
                }
                delete nextInheritance.config;
                delete nextInheritance.identityProfiles;
                delete nextInheritance.identities;
                config[INHERITANCE_KEY] = nextInheritance;
                await queryInterface.bulkUpdate("folders", { config: JSON.stringify(config) }, { id: folder.id }, { transaction });
            }
            if (rows.size) {
                await queryInterface.bulkInsert("folder_identity_profiles", [...rows.values()], { ignoreDuplicates: true, transaction });
            }
        });
    },
};
