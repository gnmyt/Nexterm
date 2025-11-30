const deleteFolderRecursive = (sftp, folderPath, callback) => {
    sftp.readdir(folderPath, (err, list) => {
        if (err) return callback(err);

        if (list.length === 0) return sftp.rmdir(folderPath, callback);

        let itemsToDelete = list.length;

        list.forEach(file => {
            const fullPath = `${folderPath}/${file.filename}`;

            if (file.longname.startsWith("d")) {
                deleteFolderRecursive(sftp, fullPath, (err) => {
                    if (err) return callback(err);

                    itemsToDelete -= 1;
                    if (itemsToDelete === 0) sftp.rmdir(folderPath, callback);
                });
            } else {
                sftp.unlink(fullPath, (err) => {
                    if (err) return callback(err);

                    itemsToDelete -= 1;
                    if (itemsToDelete === 0) sftp.rmdir(folderPath, callback);
                });
            }
        });
    });
};

const searchDirectories = (sftp, searchPath, callback, maxResults = 20) => {
    const results = [];
    const searchQuery = searchPath.toLowerCase();

    const isSearchingInside = searchPath.endsWith("/");
    let basePath, searchTerm;

    if (isSearchingInside) {
        basePath = searchPath === "/" ? "/" : searchPath.slice(0, -1);
        searchTerm = "";
    } else {
        const lastSlashIndex = searchPath.lastIndexOf("/");
        basePath = lastSlashIndex === 0 ? "/" : searchPath.substring(0, lastSlashIndex);
        searchTerm = searchPath.substring(lastSlashIndex + 1).toLowerCase();
    }

    const searchRecursive = (currentPath, depth = 0) => {
        if (depth > 3 || results.length >= maxResults) return;

        sftp.readdir(currentPath, (err, list) => {
            if (err || !list) return;

            list.forEach(file => {
                if (!file.longname.startsWith("d")) return;

                const fullPath = currentPath === "/" ? `/${file.filename}` : `${currentPath}/${file.filename}`;
                const fileName = file.filename.toLowerCase();

                if (isSearchingInside) {
                    if (currentPath === basePath) results.push(fullPath);
                } else {
                    if (fileName.startsWith(searchTerm) || fullPath.toLowerCase().includes(searchQuery)) results.push(fullPath);
                }

                if (results.length < maxResults && depth < 3) searchRecursive(fullPath, depth + 1);
            });

            if (depth === 0) {
                const uniqueResults = [...new Set(results)].sort();
                callback(null, uniqueResults.slice(0, maxResults));
            }
        });
    };

    searchRecursive(basePath || "/");
};

const OPERATIONS = {
    READY: 0x0,
    LIST_FILES: 0x1,
    UPLOAD_FILE_START: 0x2,
    UPLOAD_FILE_CHUNK: 0x3,
    UPLOAD_FILE_END: 0x4,
    CREATE_FOLDER: 0x5,
    DELETE_FILE: 0x6,
    DELETE_FOLDER: 0x7,
    RENAME_FILE: 0x8,
    ERROR: 0x9,
    SEARCH_DIRECTORIES: 0xA,
    RESOLVE_SYMLINK: 0xB,
    READ_FILE: 0xC,
    WRITE_FILE: 0xD,
};

module.exports = {
    deleteFolderRecursive,
    searchDirectories,
    OPERATIONS,
};
