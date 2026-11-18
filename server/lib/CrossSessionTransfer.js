const { Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const TransferRegistry = require("./TransferRegistry");
const { TransferCancelledError, isCancelled } = require("./EngineSftpClient");
const logger = require("../utils/logger");

const baseName = (path) => path.split("/").filter(Boolean).pop() || "";
const joinRemote = (dir, name) => (dir === "/" ? `/${name}` : `${dir.replace(/\/+$/, "")}/${name}`);

const scan = async (client, sources, throwIfCancelled) => {
    const files = [];
    const directories = [];
    const roots = [];
    let total = 0;

    const walk = async (dirPath, relative) => {
        throwIfCancelled();
        directories.push(relative);
        const entries = await client.listDir(dirPath);
        for (const entry of entries) {
            if (entry.isSymlink) continue;
            const fullPath = joinRemote(dirPath, entry.name);
            const relativePath = `${relative}/${entry.name}`;
            if (entry.type === "folder") await walk(fullPath, relativePath);
            else {
                files.push({ path: fullPath, relative: relativePath, size: entry.size });
                total += entry.size;
            }
        }
    };

    for (const path of sources) {
        throwIfCancelled();
        const stats = await client.stat(path);
        const name = baseName(path);
        roots.push({ path, isDir: stats.isDir });
        if (stats.isDir) await walk(path, name);
        else {
            files.push({ path, relative: name, size: stats.size });
            total += stats.size;
        }
    }

    return { files, directories, roots, total };
};

const runCrossSessionTransfer = async ({ id, sessionIds, sourceClient, targetClient, sources, destination, action, onFinished }) => {
    const abortController = new AbortController();
    let cancelled = false;
    let activeRead = null;

    const throwIfCancelled = () => { if (cancelled) throw new TransferCancelledError(); };

    TransferRegistry.register({
        id, sessionIds, direction: "transfer", action,
        name: baseName(sources[0]), count: sources.length, total: 0,
        cancel: () => {
            cancelled = true;
            abortController.abort();
            activeRead?.cancel();
        },
    });

    let completed = 0;
    try {
        const plan = await scan(sourceClient, sources, throwIfCancelled);
        TransferRegistry.setTotal(id, plan.total);

        for (const relative of plan.directories) {
            throwIfCancelled();
            await targetClient.mkdirRecursive(joinRemote(destination, relative));
        }

        for (const file of plan.files) {
            throwIfCancelled();
            const read = sourceClient.readFile(file.path);
            activeRead = read;
            const counter = new Transform({
                transform(chunk, _encoding, callback) {
                    TransferRegistry.progress(id, completed + chunk.length + this.counted);
                    this.counted += chunk.length;
                    callback(null, chunk);
                },
            });
            counter.counted = 0;
            const piped = pipeline(read.stream, counter);
            piped.catch(() => {});
            try {
                await targetClient.writeFile(joinRemote(destination, file.relative), counter, { signal: abortController.signal });
                await piped;
                await read.done;
            } catch (err) {
                read.cancel();
                if (cancelled || isCancelled(err)) throw new TransferCancelledError();
                throw new Error(`${baseName(file.path)}: ${err.message}`);
            } finally {
                activeRead = null;
            }
            completed += file.size;
            TransferRegistry.progress(id, completed);
        }

        if (action === "move") {
            for (const root of plan.roots) {
                throwIfCancelled();
                if (root.isDir) await sourceClient.rmdir(root.path, true);
                else await sourceClient.unlink(root.path);
            }
        }

        TransferRegistry.finish(id);
        onFinished?.(null);
    } catch (err) {
        if (isCancelled(err)) {
            TransferRegistry.finish(id, { cancelled: true });
        } else {
            logger.warn("Cross-session transfer failed", { id, error: err.message });
            TransferRegistry.finish(id, { error: err.message });
        }
        onFinished?.(err);
    }
};

module.exports = { runCrossSessionTransfer };
