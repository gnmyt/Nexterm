const crypto = require("crypto");
const Engine = require("../models/Engine");

const generateToken = () => {
    return crypto.randomBytes(32).toString("hex");
};

module.exports.createEngine = async (name) => {
    const registrationToken = generateToken();
    return Engine.create({ name, registrationToken });
};

module.exports.listEngines = async () => {
    return Engine.findAll({ order: [["createdAt", "ASC"]] });
};

module.exports.getEngine = async (id) => {
    return Engine.findByPk(id);
};

module.exports.deleteEngine = async (id) => {
    const engine = await Engine.findByPk(id);
    if (!engine) return null;
    if (engine.isLocal) return { error: "local" };
    await Engine.destroy({ where: { id } });
    return engine;
};

module.exports.regenerateToken = async (id) => {
    const engine = await Engine.findByPk(id);
    if (!engine) return null;
    if (engine.isLocal) return { error: "local" };
    const registrationToken = generateToken();
    await Engine.update({ registrationToken }, { where: { id } });
    return { ...engine, registrationToken };
};

module.exports.findByToken = async (token) => {
    return Engine.findOne({ where: { registrationToken: token } });
};

module.exports.updateLastConnected = async (id) => {
    await Engine.update({ lastConnectedAt: new Date() }, { where: { id } });
};

module.exports.ensureLocalEngine = async (token) => {
    const [engine, created] = await Engine.findOrCreate({
        where: { isLocal: true },
        defaults: { name: "Local Engine", registrationToken: token, isLocal: true },
    });

    if (!created && engine.registrationToken !== token) {
        await Engine.update({ registrationToken: token }, { where: { id: engine.id } });
    }

    return engine;
};
