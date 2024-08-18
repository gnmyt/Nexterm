module.exports.sendError = (res, httpCode, errorCode, message) =>
    res.status(httpCode).json({ code: errorCode, message });