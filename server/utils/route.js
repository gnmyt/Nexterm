const { validateSchema } = require("./schema");

module.exports.route = (doc) => {
    const middleware = (req, res, next) => {
        if (doc.params && validateSchema(res, doc.params, req.params)) return;

        if (doc.query) {
            const query = { ...req.query };
            if (validateSchema(res, doc.query, query, { allowUnknown: true })) return;
            Object.defineProperty(req, "query", { value: query, writable: true, configurable: true, enumerable: true });
        }

        if (doc.body) {
            req.body ??= {};
            if (validateSchema(res, doc.body, req.body)) return;
        }

        next();
    };
    middleware.doc = doc;
    return middleware;
};
