const fs = require("fs");
const selfsigned = require("selfsigned");
const logger = require("./logger");

const TEN_YEARS_IN_DAYS = 3650;

const ensureSelfSignedCerts = ({ certPath, keyPath, certsDir, keyDir, autoEnabled }) => {
    const certExists = fs.existsSync(certPath);
    const keyExists = fs.existsSync(keyPath);

    if (certExists && keyExists) return { status: "existing" };

    if (!certExists && !keyExists) {
        if (!autoEnabled) return { status: "missing", autoDisabled: true };

        try {
            if (certsDir) fs.mkdirSync(certsDir, { recursive: true });
            if (keyDir && keyDir !== certsDir) fs.mkdirSync(keyDir, { recursive: true });

            const attrs = [{ name: "commonName", value: "localhost" }];
            const pems = selfsigned.generate(attrs, {
                days: TEN_YEARS_IN_DAYS,
                keySize: 2048,
                algorithm: "sha256",
                extensions: [
                    {
                        name: "subjectAltName",
                        altNames: [{ type: 2, value: "localhost" }]
                    }
                ]
            });

            fs.writeFileSync(certPath, pems.cert, { mode: 0o644 });
            fs.writeFileSync(keyPath, pems.private, { mode: 0o600 });

            logger.system("Generated self-signed TLS certificate", { certPath, keyPath });
            return { status: "generated" };
        } catch (error) {
            logger.error("Failed to generate self-signed TLS certificate", { error: error.message });
            return { status: "error", error };
        }
    }

    return { status: "partial" };
};

module.exports = { ensureSelfSignedCerts };
