const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const zlib = require("node:zlib");
const crypto = require("node:crypto");
const Module = require("node:module");
const sea = require("node:sea");

if (!process.env.NODE_ENV) process.env.NODE_ENV = "production";

process.on("warning", (w) => {
    if (w.name === "ExperimentalWarning" && /localStorage/i.test(w.message)) return;
    console.warn(w.stack || `${w.name}: ${w.message}`);
});

const PAYLOAD_KEY = "app-payload.tar.gz";
const MANIFEST_KEY = "app-manifest.json";

const payloadBuf = Buffer.from(sea.getAsset(PAYLOAD_KEY));
const manifestText = new TextDecoder().decode(sea.getAsset(MANIFEST_KEY));
const meta = JSON.parse(manifestText);

const payloadHash = crypto.createHash("sha256").update(payloadBuf).digest("hex").slice(0, 16);
const cacheRoot = path.join(os.tmpdir(), `nexterm-sea-${meta.version}-${payloadHash}`);
const appDir = path.join(cacheRoot, "app");
const readyMarker = path.join(cacheRoot, ".ready");

function extract() {
    const tmp = `${cacheRoot}.tmp-${process.pid}`;
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.mkdirSync(tmp, { recursive: true });

    const tar = zlib.gunzipSync(payloadBuf);
    let offset = 0;
    while (offset < tar.length) {
        const header = tar.subarray(offset, offset + 512);
        offset += 512;
        const nameRaw = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
        if (!nameRaw) {
            if (offset >= tar.length || tar[offset] === 0) break;
            continue;
        }
        const prefix = header.subarray(345, 500).toString("utf8").replace(/\0.*$/, "");
        const name = prefix ? `${prefix}/${nameRaw}` : nameRaw;
        const sizeOctal = header.subarray(124, 136).toString("utf8").replace(/[\0 ]+$/, "");
        const size = sizeOctal ? parseInt(sizeOctal, 8) : 0;
        const typeflag = String.fromCharCode(header[156]);
        const modeOctal = header.subarray(100, 108).toString("utf8").replace(/[\0 ]+$/, "");
        const mode = modeOctal ? parseInt(modeOctal, 8) : 0o644;
        const data = tar.subarray(offset, offset + size);
        offset += Math.ceil(size / 512) * 512;

        const outPath = path.join(tmp, name);
        if (typeflag === "5") {
            fs.mkdirSync(outPath, { recursive: true });
        } else if (typeflag === "2") {
            const linkname = header.subarray(157, 257).toString("utf8").replace(/\0.*$/, "");
            fs.mkdirSync(path.dirname(outPath), { recursive: true });
            try { fs.symlinkSync(linkname, outPath); } catch {}
        } else {
            fs.mkdirSync(path.dirname(outPath), { recursive: true });
            fs.writeFileSync(outPath, data, { mode });
        }
    }

    fs.mkdirSync(path.dirname(cacheRoot), { recursive: true });
    try { fs.renameSync(tmp, cacheRoot); }
    catch (e) {
        if (e.code === "ENOTEMPTY" || e.code === "EEXIST") {
            fs.rmSync(tmp, { recursive: true, force: true });
        } else throw e;
    }
    fs.writeFileSync(readyMarker, "");
}

if (!fs.existsSync(readyMarker)) extract();

const userCwd = process.cwd();
const userDataDir = path.join(userCwd, "data");
fs.mkdirSync(userDataDir, { recursive: true });

const appDataLink = path.join(appDir, "data");
try {
    const stat = fs.lstatSync(appDataLink);
    if (!stat.isSymbolicLink() || fs.readlinkSync(appDataLink) !== userDataDir) {
        fs.rmSync(appDataLink, { recursive: true, force: true });
        fs.symlinkSync(userDataDir, appDataLink, "dir");
    }
} catch {
    fs.symlinkSync(userDataDir, appDataLink, "dir");
}

const appRequire = Module.createRequire(path.join(appDir, "package.json"));
appRequire(path.join(appDir, "server", "index.js"));
