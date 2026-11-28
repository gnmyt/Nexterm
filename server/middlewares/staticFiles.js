const fs = require("node:fs");
const path = require("node:path");

const HASHED = /^\/assets\/[^/]+-[A-Za-z0-9_-]{8}\.[a-z0-9]+$/;
const ENCODINGS = [["br", ".br"], ["gzip", ".gz"]];

const acceptedEncodings = (header) => new Set(String(header || "").split(",")
    .map(part => part.trim().toLowerCase().split(/\s*;\s*/))
    .filter(([, quality]) => !/^q=0(\.0*)?$/.test(quality || ""))
    .map(([name]) => name));

const scan = (root) => {
    const files = new Map();
    const walk = (dir, url) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const names = new Set(entries.filter(entry => entry.isFile()).map(entry => entry.name));
        for (const entry of entries) {
            if (entry.isDirectory()) {
                walk(path.join(dir, entry.name), `${url}/${entry.name}`);
                continue;
            }
            if (!entry.isFile() || ENCODINGS.some(([, suffix]) => entry.name.endsWith(suffix) && names.has(entry.name.slice(0, -suffix.length)))) continue;
            const variant = (suffix) => {
                const file = path.join(dir, entry.name + suffix);
                const stat = fs.statSync(file);
                return { file, size: stat.size, etag: `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}${suffix}"` };
            };
            files.set(`${url}/${entry.name}`, {
                type: path.extname(entry.name),
                plain: variant(""),
                encoded: ENCODINGS.filter(([, suffix]) => names.has(entry.name + suffix)).map(([encoding, suffix]) => ({ encoding, ...variant(suffix) })),
            });
        }
    };
    walk(root, "");
    return files;
};

module.exports = (root) => {
    const files = scan(root);

    const send = (req, res, entry, cacheControl) => {
        const accepted = acceptedEncodings(req.headers["accept-encoding"]);
        const chosen = entry.encoded.find(({ encoding }) => accepted.has(encoding)) || entry.plain;

        res.type(entry.type || "application/octet-stream");
        res.set("Cache-Control", cacheControl);
        res.set("ETag", chosen.etag);
        if (entry.encoded.length) res.set("Vary", "Accept-Encoding");
        if (req.headers["if-none-match"] === chosen.etag) return res.status(304).end();

        if (chosen.encoding) res.set("Content-Encoding", chosen.encoding);
        res.set("Content-Length", String(chosen.size));
        if (req.method === "HEAD") return res.end();
        fs.createReadStream(chosen.file).on("error", () => res.destroy()).pipe(res);
    };

    const middleware = (req, res, next) => {
        if ((req.method !== "GET" && req.method !== "HEAD") || req.headers.range) return next();
        let url;
        try {
            url = decodeURIComponent(req.path);
        } catch {
            return next();
        }
        const entry = files.get(url);
        if (!entry) return next();
        send(req, res, entry, HASHED.test(url) ? "public, max-age=31536000, immutable" : "no-cache");
    };

    middleware.index = (req, res, next) => {
        const entry = files.get("/index.html");
        if (!entry) return next();
        send(req, res, entry, "no-cache");
    };

    return middleware;
};
