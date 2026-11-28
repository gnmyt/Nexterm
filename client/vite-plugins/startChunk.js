export const startChunk = () => {
    const modules = new Set();
    return {
        name: "nexterm-start-chunk",
        apply: "build",
        buildEnd() {
            const visit = (id) => {
                if (modules.has(id)) return;
                modules.add(id);
                for (const imported of this.getModuleInfo(id)?.importedIds || []) visit(imported);
            };
            for (const id of this.getModuleIds()) if (this.getModuleInfo(id)?.isEntry) visit(id);
        },
        isStartModule: (id) => modules.has(id),
    };
};
