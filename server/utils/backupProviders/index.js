const LocalProvider = require("./local");
const SmbProvider = require("./smb");
const WebdavProvider = require("./webdav");

module.exports.createProvider = (provider) => {
    switch (provider.type) {
        case "local": return new LocalProvider(provider);
        case "smb": return new SmbProvider(provider);
        case "webdav": return new WebdavProvider(provider);
        default: throw new Error(`Unknown provider type: ${provider.type}`);
    }
};
