const { QueryTypes } = require("sequelize");

const INHERITANCE_KEY = "__nextermInheritance";
const MACHINE_FIELDS = ["ip", "macAddress", "wolBroadcastAddress"];
const DETAIL_FIELDS = new Set(["engineId", "port", ...MACHINE_FIELDS]);

const parseConfig = (value) => {
    if (!value) return {};
    if (typeof value === "object") return value;
    try { return JSON.parse(value); } catch { return {}; }
};

const sectionOf = (key) => (DETAIL_FIELDS.has(key) ? "details" : "settings");

const resolveMachineFields = (folder, protocol, foldersById) => {
    const lineage = [];
    const visited = new Set();
    for (let current = folder; current && !visited.has(current.id); current = foldersById.get(current.parentId)) {
        visited.add(current.id);
        lineage.unshift(current);
    }

    let values = {};
    for (const { inheritance } of lineage) {
        if (!inheritance) continue;
        const own = Object.fromEntries(Object.entries(inheritance.profiles?.[protocol] || {}).filter(([key]) => DETAIL_FIELDS.has(key)));
        const enabled = inheritance.sectionEnabled?.[protocol]?.details ?? (Object.keys(own).length ? true : undefined);
        if (enabled === undefined) continue;
        values = enabled ? { ...values, ...own } : {};
    }
    return Object.fromEntries(Object.entries(values).filter(([key]) => MACHINE_FIELDS.includes(key)));
};

module.exports = {
    async up(queryInterface) {
        const sequelize = queryInterface.sequelize;
        await sequelize.transaction(async (transaction) => {
            const folders = (await sequelize.query("SELECT id, parentId, config FROM folders", { type: QueryTypes.SELECT, transaction }))
                .map((folder) => {
                    const config = parseConfig(folder.config);
                    return { id: Number(folder.id), parentId: folder.parentId === null ? null : Number(folder.parentId), config, inheritance: config[INHERITANCE_KEY] };
                });
            if (!folders.some((folder) => folder.inheritance)) return;
            const foldersById = new Map(folders.map((folder) => [folder.id, folder]));

            const entries = await sequelize.query(
                "SELECT id, folderId, config FROM entries WHERE type = 'server' AND folderId IS NOT NULL",
                { type: QueryTypes.SELECT, transaction }
            );
            for (const entry of entries) {
                const config = parseConfig(entry.config);
                const folder = foldersById.get(Number(entry.folderId));
                if (!folder || !config.protocol) continue;
                const inherited = Object.entries(resolveMachineFields(folder, config.protocol, foldersById))
                    .filter(([key]) => !Object.hasOwn(config, key));
                if (!inherited.length) continue;
                await queryInterface.bulkUpdate("entries",
                    { config: JSON.stringify({ ...config, ...Object.fromEntries(inherited) }) }, { id: entry.id }, { transaction });
            }

            for (const folder of folders) {
                if (!folder.inheritance) continue;
                const { profiles = {}, sectionEnabled = {} } = folder.inheritance;

                const nextProfiles = {};
                for (const [protocol, profile] of Object.entries(profiles)) {
                    const kept = Object.entries(profile || {}).filter(([key]) =>
                        !MACHINE_FIELDS.includes(key) && key !== "protocol" && sectionEnabled[protocol]?.[sectionOf(key)] !== false);
                    if (kept.length) nextProfiles[protocol] = Object.fromEntries(kept);
                }
                for (const [protocol, sections] of Object.entries(sectionEnabled)) {
                    if (sections?.identities !== false) continue;
                    await queryInterface.bulkDelete("folder_identity_profiles", { folderId: folder.id, protocol }, { transaction });
                }

                await queryInterface.bulkUpdate("folders",
                    { config: JSON.stringify({ ...folder.config, [INHERITANCE_KEY]: { profiles: nextProfiles } }) }, { id: folder.id }, { transaction });
            }
        });
    },
};
