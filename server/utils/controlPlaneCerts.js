const path = require("node:path");
const fs = require("node:fs");
const selfsigned = require("selfsigned");
const logger = require("./logger");

const CERTS_DIR = path.join(__dirname, "../../data/certs");
const CP_CERT_PATH = path.join(CERTS_DIR, "cp-cert.pem");
const CP_KEY_PATH = path.join(CERTS_DIR, "cp-key.pem");

const ensureCPCerts = () => {
    if (!fs.existsSync(CP_CERT_PATH) || !fs.existsSync(CP_KEY_PATH)) {
        logger.system("Generating self-signed control plane TLS certificates...");
        fs.mkdirSync(CERTS_DIR, { recursive: true });
        const pems = selfsigned.generate([{ name: "commonName", value: "nexterm-control-plane" }], {
            keySize: 2048,
            days: 3650,
        });
        fs.writeFileSync(CP_CERT_PATH, pems.cert);
        fs.writeFileSync(CP_KEY_PATH, pems.private, { mode: 0o600 });
        logger.system("Control plane TLS certificates generated");
    }

    return { cert: fs.readFileSync(CP_CERT_PATH), key: fs.readFileSync(CP_KEY_PATH) };
};

module.exports = { ensureCPCerts };
