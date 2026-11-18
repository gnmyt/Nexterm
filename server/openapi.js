const j2s = require("joi-to-swagger");
const swaggerUi = require("swagger-ui-express");
const packageJson = require("../package.json");
const { authenticate } = require("./middlewares/auth");

const TAGS = { ai: "AI", mcp: "MCP", auth: "Authentication" };

const binary = { type: "string", format: "binary" };
const errorResponse = (description) => ({
    description,
    content: {
        "application/json": {
            schema: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
        },
    },
});

const describeOperation = (doc, path, handlers) => {
    const secured = handlers.includes(authenticate);
    const permissions = [...new Set(handlers.map((handler) => handler.permission).filter(Boolean))];
    const permissionNote = permissions.length
        && `Requires the ${permissions.map((permission) => `\`${permission}\``).join(" and ")} permission${permissions.length > 1 ? "s" : ""}.`;
    const paramSchemas = doc.params ? j2s(doc.params).swagger.properties : {};

    const parameters = [...path.matchAll(/\{(\w+)}/g)]
        .map(([, name]) => ({ name, in: "path", required: true, schema: paramSchemas[name] || { type: "string" } }));

    if (doc.query) {
        const { properties, required = [] } = j2s(doc.query).swagger;
        for (const [name, { description, ...schema }] of Object.entries(properties))
            parameters.push({ name, in: "query", required: required.includes(name), description, schema });
    }

    const bodySchema = doc.body ? j2s(doc.body).swagger : doc.consumes && binary;
    const response = doc.produces
        ? { [doc.produces]: { schema: binary } }
        : { "application/json": { schema: doc.returns ? j2s(doc.returns).swagger : { type: "object" } } };

    return {
        summary: doc.summary,
        description: [doc.description, permissionNote].filter(Boolean).join("\n\n"),
        tags: [doc.tag],
        parameters,
        ...(secured && { security: [{ BearerAuth: [] }] }),
        ...(bodySchema && {
            requestBody: { required: true, content: { [doc.consumes || "application/json"]: { schema: bodySchema } } },
        }),
        responses: {
            [doc.status || 200]: { description: "Success", content: response },
            ...((doc.body || doc.params || doc.query) && { 400: errorResponse("The request is invalid") }),
            ...(secured && { 401: errorResponse("The token is missing or not valid") }),
            ...(permissions.length && { 403: errorResponse("The account lacks the required permission") }),
        },
    };
};

const describeRoutes = () => {
    const paths = {};

    const use = (prefix, ...handlers) => {
        const router = handlers.at(-1);
        if (typeof prefix !== "string" || !router?.stack) return;

        const base = prefix.replace(/^\/api/, "");
        const group = base.split("/")[1];
        const tag = TAGS[group] || group.replace(/-/g, " ").replace(/^./, (char) => char.toUpperCase());

        for (const { route } of router.stack) {
            if (!route) continue;

            const routeHandlers = route.stack.map((layer) => layer.handle);
            const doc = routeHandlers.find((handler) => handler.doc)?.doc;
            if (!doc) continue;

            const path = (base + route.path).replace(/\/$/, "").replace(/:(\w+)/g, "{$1}");
            for (const method of Object.keys(route.methods))
                (paths[path] ||= {})[method] = describeOperation({ tag, ...doc }, path, [...handlers, ...routeHandlers]);
        }
    };

    require("./routes")({ use });

    return paths;
};

const generateOpenAPISpec = () => ({
    openapi: "3.0.0",
    info: {
        title: "Nexterm API",
        version: packageJson.version,
        description: "REST API of Nexterm. Requests that pass validation but cannot be fulfilled (missing "
            + "permission, unknown id, ...) are often answered with status 200 and a body of the form "
            + "`{ code, message }`, so check the response for a `code` field.",
    },
    servers: [
        { url: "/api", description: "Production API server" },
        { url: "http://localhost:6989/api", description: "Development API server" },
    ],
    components: {
        securitySchemes: {
            BearerAuth: {
                type: "http",
                scheme: "bearer",
                description: "An API key (Settings → Account → API Keys) or a session token",
            },
        },
    },
    paths: describeRoutes(),
});

module.exports.generateOpenAPISpec = generateOpenAPISpec;

module.exports.serveOpenAPISpec = (app) => {
    const spec = generateOpenAPISpec();

    app.get("/api-docs.json", (req, res) => res.json(spec));
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(spec, {
        customSiteTitle: "Nexterm API Documentation",
        customfavIcon: "/assets/img/favicon.png",
    }));
};
