const prepareSSH = require("../utils/sshPreCheck");

module.exports = async (ws, req) => {
    const ssh = await prepareSSH(ws, req);
    if (!ssh) return;

    const OPERATIONS = {
        READY: 0x0,
        LIST_FILES: 0x1,
        UPLOAD_FILE_START: 0x2,
        UPLOAD_FILE_CHUNK: 0x3,
        UPLOAD_FILE_END: 0x4,
        CREATE_FOLDER: 0x5,
        DELETE_ITEM: 0x6,
    };

    let fileBuffers = {};

    ssh.on("ready", () => {
        ssh.sftp((err, sftp) => {
            ws.send(Buffer.from([OPERATIONS.READY]));

            ws.on("message", (msg) => {
                const operation = msg[0];
                const payload = JSON.parse(msg.slice(1).toString());

                switch (operation) {
                    case OPERATIONS.LIST_FILES:
                        sftp.readdir(payload.path, (err, list) => {
                            if (err) {
                                return;
                            }
                            const files = list.map(file => ({
                                name: file.filename,
                                type: file.longname.startsWith("d") ? "folder" : "file",
                                last_modified: file.attrs.mtime,
                                size: file.attrs.size,
                            }));
                            ws.send(Buffer.concat([
                                Buffer.from([OPERATIONS.LIST_FILES]),
                                Buffer.from(JSON.stringify({ files })),
                            ]));
                        });
                        break;

                    case OPERATIONS.UPLOAD_FILE_START:
                        fileBuffers[payload.fileName] = [];
                        ws.send(Buffer.from([OPERATIONS.UPLOAD_FILE_START]));
                        break;

                    case OPERATIONS.UPLOAD_FILE_CHUNK:
                        if (fileBuffers[payload.fileName]) {
                            fileBuffers[payload.fileName].push(Buffer.from(payload.chunk, "base64"));
                        }
                        ws.send(Buffer.from([OPERATIONS.UPLOAD_FILE_CHUNK]));
                        break;

                    case OPERATIONS.UPLOAD_FILE_END:
                        const finalFile = Buffer.concat(fileBuffers[payload.fileName]);
                        const writeStream = sftp.createWriteStream(payload.path);

                        writeStream.end(finalFile, () => {
                            delete fileBuffers[payload.fileName];
                            ws.send(Buffer.from([OPERATIONS.UPLOAD_FILE_END]));
                        });
                        break;

                    case OPERATIONS.CREATE_FOLDER:
                        sftp.mkdir(payload.path, (err) => {
                            if (err) throw err;
                            ws.send(Buffer.from([OPERATIONS.CREATE_FOLDER]));
                        });
                        break;

                    case OPERATIONS.DELETE_ITEM:
                        sftp.rm(payload.path, (err) => {
                            if (err) throw err;
                            ws.send(Buffer.from([OPERATIONS.DELETE_ITEM]));
                        });
                        break;
                }
            });
        });
    });
};