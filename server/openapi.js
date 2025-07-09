const path = require("path");
const fs = require("fs");
const expressJSDocSwagger = require("express-jsdoc-swagger");
const packageJson = require("../package.json");
const { extractSchemasFromValidation } = require("./utils/joiToOpenApi");

const extractValidationSchemas = () => {
    const schemas = {};
    const validationPath = path.resolve(__dirname, "validations");

    try {
        const files = fs.readdirSync(validationPath);
        const validationFiles = files
            .filter(file => file.endsWith('.js'))
            .map(file => path.join(validationPath, file));

        validationFiles.forEach(file => {
            try {
                const validationModule = require(file);
                const extractedSchemas = extractSchemasFromValidation(validationModule);
                Object.assign(schemas, extractedSchemas);
            } catch (err) {
                console.warn(`Warning: Could not extract schemas from ${file}:`, err.message);
            }
        });
    } catch (err) {
        console.warn("Warning: Could not scan validation directory:", err.message);
    }

    return schemas;
};

module.exports.generateOpenAPISpec = (app) => {
    const validationSchemas = extractValidationSchemas();

    const options = {
        info: {
            title: "Nexterm API",
            version: packageJson.version,
            description: "API documentation for Nexterm",
        },
        servers: [
            { url: "/api", description: "Production API server" },
            { url: "http://localhost:6989/api", description: "Development API server" },
        ],
        baseDir: __dirname,
        filesPattern: ["./routes/**/*.js",],
        swaggerUIPath: "/api-docs",
        exposeSwaggerUI: true,
        exposeApiDocs: true,
        apiDocsPath: '/api-docs.json',
        notRequiredAsNullable: false,
        swaggerUiOptions: {
            customSiteTitle: 'Nexterm API Documentation',
            customfavIcon: '/assets/img/favicon.png',
        },
        security: {
            BearerAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "session",
                description: "Enter your session token to authenticate API requests",
            },
        },
    };

    return new Promise((resolve, reject) => {
        const instance = expressJSDocSwagger(app)(options);

        instance.on("finish", (swaggerSpec) => {
            try {
                Object.assign(swaggerSpec.components.schemas, validationSchemas);

                resolve(swaggerSpec);
            } catch (error) {
                reject(error);
            }
        });

        instance.on("error", (error) => {
            reject(error);
        });
    });
};
