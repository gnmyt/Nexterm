const { createClient } = require("webdav");

module.exports = class WebdavProvider {
    constructor(provider) {
        this.url = provider.url;
        this.folder = provider.folder || "";
        this.username = provider.username;
        this.password = provider.password;
    }

    getClient() {
        return createClient(this.url, {
            username: this.username,
            password: this.password,
        });
    }

    getPath(name) {
        const folder = this.folder.replace(/^\/|\/$/g, "");
        return folder ? `/${folder}/${name}` : `/${name}`;
    }

    getFolderPath() {
        const folder = this.folder.replace(/^\/|\/$/g, "");
        return folder ? `/${folder}` : "/";
    }

    async test() {
        const client = this.getClient();
        const folderPath = this.getFolderPath();
        const exists = await client.exists(folderPath);
        if (!exists) await client.createDirectory(folderPath, { recursive: true });
        return true;
    }

    async upload(buffer, name) {
        const client = this.getClient();
        const folderPath = this.getFolderPath();
        const exists = await client.exists(folderPath);
        if (!exists) await client.createDirectory(folderPath, { recursive: true });
        await client.putFileContents(this.getPath(name), buffer);
    }

    async download(name) {
        const client = this.getClient();
        return await client.getFileContents(this.getPath(name));
    }

    async list() {
        const client = this.getClient();
        const folderPath = this.getFolderPath();
        const exists = await client.exists(folderPath);
        if (!exists) return [];

        const items = await client.getDirectoryContents(folderPath);
        return items
            .filter(f => f.basename.startsWith("backup-") && f.basename.endsWith(".tar.gz"))
            .map(f => ({ name: f.basename, size: f.size, created: new Date(f.lastmod) }))
            .sort((a, b) => b.created - a.created);
    }

    async delete(name) {
        const client = this.getClient();
        try {
            await client.deleteFile(this.getPath(name));
        } catch { }
    }
};
