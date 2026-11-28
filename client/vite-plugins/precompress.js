import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import zlib from "node:zlib";

const brotli = promisify(zlib.brotliCompress), gzip = promisify(zlib.gzip);
const COMPRESSIBLE = /\.(js|mjs|css|html|json|svg|txt|xml|map|wasm|ttf|otf)$/;
const MIN_BYTES = 1024;
const PARALLEL = 4;

const listFiles = async (dir) => (await Promise.all((await fs.readdir(dir, { withFileTypes: true })).map((entry) =>
    entry.isDirectory() ? listFiles(path.join(dir, entry.name)) : [path.join(dir, entry.name)]))).flat();

export const precompress = () => {
    let outDir;
    return {
        name: "nexterm-precompress",
        apply: "build",
        configResolved(config) {
            outDir = path.resolve(config.root, config.build.outDir);
        },
        async closeBundle() {
            if (process.env.TAURI_ENV_PLATFORM) return;
            const queue = (await listFiles(outDir)).filter((file) => COMPRESSIBLE.test(file));
            const work = async () => {
                for (let file = queue.pop(); file; file = queue.pop()) {
                    const source = await fs.readFile(file);
                    if (source.length < MIN_BYTES) continue;
                    const [brotliCompressed, gzipCompressed] = await Promise.all([
                        brotli(source, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: source.length } }),
                        gzip(source, { level: 9 }),
                    ]);
                    if (brotliCompressed.length < source.length) await fs.writeFile(`${file}.br`, brotliCompressed);
                    if (gzipCompressed.length < source.length) await fs.writeFile(`${file}.gz`, gzipCompressed);
                }
            };
            await Promise.all(Array.from({ length: PARALLEL }, work));
        },
    };
};
