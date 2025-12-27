const fs = require("fs");
const path = require("path");

module.exports = class LocalProvider {
    constructor(config) {
        this.path = config.path;
    }

    async test() {
        if (!fs.existsSync(this.path)) {
            fs.mkdirSync(this.path, { recursive: true });
        }
        const testFile = path.join(this.path, ".nexterm-test");
        fs.writeFileSync(testFile, "test");
        fs.unlinkSync(testFile);
        return true;
    }

    async upload(buffer, name) {
        if (!fs.existsSync(this.path)) fs.mkdirSync(this.path, { recursive: true });
        fs.writeFileSync(path.join(this.path, name), buffer);
    }

    async download(name) {
        return fs.readFileSync(path.join(this.path, name));
    }

    async list() {
        if (!fs.existsSync(this.path)) return [];
        return fs.readdirSync(this.path)
            .filter(f => f.startsWith("backup-") && f.endsWith(".tar.gz"))
            .map(name => {
                const stat = fs.statSync(path.join(this.path, name));
                return { name, size: stat.size, created: stat.mtime };
            })
            .sort((a, b) => b.created - a.created);
    }

    async delete(name) {
        const filePath = path.join(this.path, name);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
};
