const LocalProvider = require("./local");
const SmbProvider = require("./smb");
const WebdavProvider = require("./webdav");

module.exports.createProvider = (provider) => {
    switch (provider.type) {
        case "local": return new LocalProvider(provider.config);
        case "smb": return new SmbProvider(provider.config);
        case "webdav": return new WebdavProvider(provider.config);
        default: throw new Error(`Unknown provider type: ${provider.type}`);
    }
};
