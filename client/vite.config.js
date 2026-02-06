import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import * as path from "path";
import * as fs from "fs";
import * as http from "node:http";
import * as https from "node:https";
import { createRequire } from "node:module";

const ensureUpgradeCallback = (ServerCtor) => {
    if (!ServerCtor?.prototype) return;
    if (typeof ServerCtor.prototype.shouldUpgradeCallback !== "function") {
        Object.defineProperty(ServerCtor.prototype, "shouldUpgradeCallback", {
            value: () => true,
            writable: true,
            configurable: true
        });
    }
};

ensureUpgradeCallback(http.Server);
ensureUpgradeCallback(https.Server);

const require = createRequire(import.meta.url);

const DEFAULT_CERT_PATH = process.env.SSL_CERT_PATH || path.resolve(__dirname, "../data/certs/cert.pem");
const DEFAULT_KEY_PATH = process.env.SSL_KEY_PATH || path.resolve(__dirname, "../data/certs/key.pem");

const loadOrCreateDevCerts = () => {
    if (fs.existsSync(DEFAULT_CERT_PATH) && fs.existsSync(DEFAULT_KEY_PATH)) {
        return {
            cert: fs.readFileSync(DEFAULT_CERT_PATH),
            key: fs.readFileSync(DEFAULT_KEY_PATH)
        };
    }

    const selfsigned = require("selfsigned");
    fs.mkdirSync(path.dirname(DEFAULT_CERT_PATH), { recursive: true });
    fs.mkdirSync(path.dirname(DEFAULT_KEY_PATH), { recursive: true });

    const attrs = [{ name: "commonName", value: "localhost" }];
    const pems = selfsigned.generate(attrs, {
        days: 3650,
        keySize: 2048,
        algorithm: "sha256",
        extensions: [
            {
                name: "subjectAltName",
                altNames: [{ type: 2, value: "localhost" }]
            }
        ]
    });

    fs.writeFileSync(DEFAULT_CERT_PATH, pems.cert, { mode: 0o644 });
    fs.writeFileSync(DEFAULT_KEY_PATH, pems.private, { mode: 0o600 });

    return { cert: pems.cert, key: pems.private };
};

const guacamolePlugin = () => {
    const modulesDir = path.resolve(__dirname, '../vendor/guacamole-client/guacamole-common-js/src/main/webapp/modules');
    const virtualId = 'virtual:guacamole-common-js';

    return {
        name: 'guacamole-common-js',
        resolveId(id) {
            if (id === 'guacamole-common-js') return virtualId;
        },
        load(id) {
            if (id === virtualId) {
                const files = ['Namespace.js', ...fs.readdirSync(modulesDir)
                    .filter(f => f.endsWith('.js') && f !== 'Namespace.js').sort()];
                const content = files.map(f => fs.readFileSync(path.join(modulesDir, f), 'utf-8')).join('\n');
                return content + '\nexport default Guacamole;\n';
            }
        }
    };
}

const fixUpgradeCallbackPlugin = () => ({
    name: "fix-upgrade-callback",
    configureServer(server) {
        const httpServer = server.httpServer;
        if (!httpServer) return;

        const defineUpgradeCallback = () => {
            Object.defineProperty(httpServer, "shouldUpgradeCallback", {
                configurable: true,
                get: () => () => true,
                set: () => {}
            });
        };

        defineUpgradeCallback();

        httpServer.on("upgrade", () => {
            if (typeof httpServer.shouldUpgradeCallback !== "function") {
                defineUpgradeCallback();
            }
        });
    }
});

export default defineConfig({
    plugins: [guacamolePlugin(), fixUpgradeCallbackPlugin(), react()],
    css: {
        preprocessorOptions: {
            sass: {
                api: "modern"
            }
        }
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src"),
        }
    },
    server: {
        https: loadOrCreateDevCerts(),
        proxy: {
            "/api": {
                target: "https://localhost:5878",
                ws: true,
                secure: false
            }
        }
    }
});
