const deleteFolderRecursive = (sftp, folderPath, callback) => {
    sftp.readdir(folderPath, (err, list) => {
        if (err) return err.code === 2 ? callback(null) : callback(err);

        if (!list || list.length === 0) {
            return sftp.rmdir(folderPath, (err) => callback(err?.code !== 2 ? err : null));
        }

        let remaining = list.length;
        let hasError = false;

        const onDeleted = (err) => {
            if (hasError) return;
            if (err && err.code !== 2) { hasError = true; return callback(err); }
            if (--remaining === 0) sftp.rmdir(folderPath, (err) => callback(err?.code !== 2 ? err : null));
        };

        list.forEach(file => {
            if (hasError) return;
            const fullPath = `${folderPath}/${file.filename}`;
            file.longname.startsWith("d") ? deleteFolderRecursive(sftp, fullPath, onDeleted) : sftp.unlink(fullPath, onDeleted);
        });
    });
};

const searchDirectories = (sftp, searchPath, callback, maxResults = 20) => {
    const results = [];
    const searchQuery = searchPath.toLowerCase();
    let done = false, pending = 0, timeoutId = null;

    const finish = (err, data) => {
        if (done) return;
        done = true;
        if (timeoutId) clearTimeout(timeoutId);
        callback(err, data);
    };

    const getResults = () => [...new Set(results)].sort().slice(0, maxResults);

    timeoutId = setTimeout(() => { if (!done) finish(null, getResults()); }, 5000);

    const isInside = searchPath.endsWith("/");
    const lastSlash = searchPath.lastIndexOf("/");
    const basePath = isInside ? (searchPath === "/" ? "/" : searchPath.slice(0, -1)) : (lastSlash === 0 ? "/" : searchPath.substring(0, lastSlash));
    const searchTerm = isInside ? "" : searchPath.substring(lastSlash + 1).toLowerCase();

    const checkDone = () => { if (--pending === 0 && !done) finish(null, getResults()); };

    const search = (currentPath, depth = 0) => {
        if (done || depth > 3 || results.length >= maxResults) return checkDone();

        sftp.readdir(currentPath, (err, list) => {
            if (done || err || !list) return checkDone();

            const dirs = list.filter(f => f.longname.startsWith("d"));
            if (dirs.length === 0) return checkDone();

            dirs.forEach(file => {
                if (done || results.length >= maxResults) return;
                const fullPath = currentPath === "/" ? `/${file.filename}` : `${currentPath}/${file.filename}`;
                const name = file.filename.toLowerCase();

                if (isInside ? currentPath === basePath : (name.startsWith(searchTerm) || fullPath.toLowerCase().includes(searchQuery))) {
                    results.push(fullPath);
                }

                if (results.length < maxResults && depth < 3) { pending++; search(fullPath, depth + 1); }
            });
            checkDone();
        });
    };

    pending = 1;
    search(basePath || "/");
};

const OPERATIONS = {
    READY: 0x0, LIST_FILES: 0x1, CREATE_FOLDER: 0x5, DELETE_FILE: 0x6,
    DELETE_FOLDER: 0x7, RENAME_FILE: 0x8, ERROR: 0x9, SEARCH_DIRECTORIES: 0xA,
    RESOLVE_SYMLINK: 0xB,
};

const addFolderToArchive = (sftp, folderPath, archive, basePath = "", activeStreams = [], options = {}) => {
    const { timeout = 60000, maxFiles = 10000, concurrency = 8 } = options;
    let fileCount = 0;

    const processFile = (fullPath, archivePath) => new Promise((res, rej) => {
        const tid = setTimeout(() => rej(new Error(`Timeout: ${fullPath}`)), timeout);
        let resolved = false;
        const done = (err) => {
            if (resolved) return;
            resolved = true;
            clearTimeout(tid);
            err && err.code !== 3 ? rej(err) : res();
        };

        try {
            const stream = sftp.createReadStream(fullPath, { highWaterMark: 64 * 1024 });
            activeStreams.push(stream);
            stream.on("error", done);
            stream.on("end", () => done());
            stream.on("close", () => done());
            archive.append(stream, { name: archivePath });
        } catch (e) { clearTimeout(tid); rej(e); }
    });

    const processInBatches = async (items, processor) => {
        for (let i = 0; i < items.length; i += concurrency) {
            await Promise.all(items.slice(i, i + concurrency).map(processor));
        }
    };

    const addFolder = async (currentPath, currentBasePath) => {
        const list = await new Promise((resolve, reject) => {
            const tid = setTimeout(() => reject(new Error(`Timeout: ${currentPath}`)), timeout);
            sftp.readdir(currentPath, (err, list) => {
                clearTimeout(tid);
                if (err) return err.code === 3 ? resolve([]) : reject(err);
                resolve(list || []);
            });
        });

        if (!list.length) {
            try { archive.append("", { name: currentBasePath + "/" }); } catch {}
            return;
        }

        const files = [], dirs = [];
        for (const file of list) {
            if (file.longname.startsWith("l")) continue;
            if (++fileCount > maxFiles) break;
            const fullPath = currentPath === "/" ? `/${file.filename}` : `${currentPath}/${file.filename}`;
            const archivePath = currentBasePath ? `${currentBasePath}/${file.filename}` : file.filename;
            (file.longname.startsWith("d") ? dirs : files).push({ fullPath, archivePath });
        }

        await processInBatches(files, ({ fullPath, archivePath }) => processFile(fullPath, archivePath));
        for (const { fullPath, archivePath } of dirs) await addFolder(fullPath, archivePath);
    };

    return addFolder(folderPath, basePath);
};

module.exports = { deleteFolderRecursive, searchDirectories, addFolderToArchive, OPERATIONS };
