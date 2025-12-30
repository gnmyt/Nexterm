module.exports.sendError = (res, httpCode, errorCode, message, extra = {}) =>
    res.status(httpCode).json({ code: errorCode, message, ...extra });