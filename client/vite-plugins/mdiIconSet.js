import * as mdi from "@mdi/js";

const VIRTUAL_MODULE = "virtual:mdi-icon-set";
const PART_SIZE = 64;

export const mdiIconSet = () => {
    const names = Object.keys(mdi).filter((name) => typeof mdi[name] === "string").sort();
    const parts = [];
    for (let i = 0; i < names.length; i += PART_SIZE) parts.push(names.slice(i, i + PART_SIZE));

    let building = false;

    return {
        name: "nexterm-mdi-icon-set",
        configResolved(config) {
            building = config.command === "build";
        },
        transform(code, id) {
            if (!building || id.includes("/node_modules/") || !code.includes("@mdi/js")) return;
            const replaced = code.replace(/import\s*\{([^}]*)\}\s*from\s*["']@mdi\/js["'];?/g, (statement, list) => {
                const icons = list.split(",").map((name) => name.trim()).filter(Boolean);
                const lines = statement.split("\n").length - 1;
                return icons.map((name) => `import ${name} from "${VIRTUAL_MODULE}/icon/${name}";`).join(" ") + "\n".repeat(lines);
            });
            return replaced === code ? undefined : { code: replaced, map: null };
        },
        resolveId(id) {
            if (id === VIRTUAL_MODULE || id.startsWith(`${VIRTUAL_MODULE}/`)) return `\0${id}`;
        },
        load(id) {
            if (id === `\0${VIRTUAL_MODULE}`) {
                return `const first = ${JSON.stringify(parts.map((part) => part[0]))};
const parts = [${parts.map((_, index) => `() => import("${VIRTUAL_MODULE}/mdi-part-${index}")`).join(", ")}];
const loaded = new Map();
export const loadIcon = (name) => {
    let index = first.length - 1;
    while (index > 0 && first[index] > name) index--;
    if (!loaded.has(index)) loaded.set(index, parts[index]().then((module) => module.default, (error) => { loaded.delete(index); throw error; }));
    return loaded.get(index).then((icons) => icons[name]);
};
`;
            }
            if (id === `\0${VIRTUAL_MODULE}/mdi-all`) return `export default ${JSON.stringify(Object.fromEntries(names.map((name) => [name, mdi[name]])))};`;
            if (id.startsWith(`\0${VIRTUAL_MODULE}/icon/`)) {
                const name = id.slice(VIRTUAL_MODULE.length + 7);
                if (typeof mdi[name] !== "string") this.error(`@mdi/js has no icon ${name}`);
                return `export default ${JSON.stringify(mdi[name])};`;
            }
            if (id.startsWith(`\0${VIRTUAL_MODULE}/mdi-part-`)) {
                const part = parts[Number(id.slice(VIRTUAL_MODULE.length + 11))];
                return `export default ${JSON.stringify(Object.fromEntries(part.map((name) => [name, mdi[name]])))};`;
            }
        },
    };
};
