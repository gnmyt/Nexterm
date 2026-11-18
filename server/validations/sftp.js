const Joi = require("joi");

const sessionToken = Joi.string().required().description("Session authentication token");
const sessionId = Joi.string().required().description("Id of the active file session");
const transferId = Joi.string().description("Client-chosen identifier used for progress reporting and cancellation");

module.exports.uploadQuery = Joi.object({
    sessionToken,
    sessionId,
    path: Joi.string().required().description("Remote destination path of the uploaded file"),
    transferId,
});

module.exports.downloadQuery = Joi.object({
    sessionToken,
    sessionId,
    path: Joi.string().required().description("Remote file or folder to download"),
    preview: Joi.string().description("Set to `true` to display the file inline instead of downloading it"),
    thumbnail: Joi.string().description("Set to `true` to get a thumbnail (images only)"),
    size: Joi.number().description("Thumbnail size in pixels, between 50 and 300 (default: 100)"),
    transferId,
});

module.exports.multiDownloadQuery = Joi.object({ sessionToken, sessionId, transferId });

module.exports.multiDownloadBody = Joi.object({
    paths: Joi.alternatives(Joi.array().items(Joi.string()).min(1), Joi.string()).required()
        .description("Files and folders to include, as an array or a JSON encoded array"),
});

module.exports.transferQuery = Joi.object({ sessionToken, transferId: transferId.required() });

module.exports.transferBody = Joi.object({
    sourceSessionId: Joi.string().required(),
    targetSessionId: Joi.string().required(),
    sources: Joi.array().items(Joi.string()).min(1).required().description("Paths on the source session"),
    destination: Joi.string().required().description("Directory on the target session"),
    action: Joi.string().valid("copy", "move").required(),
});
