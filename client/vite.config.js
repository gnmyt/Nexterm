import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import * as path from "path";
import * as fs from "fs";

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

export default defineConfig({
    plugins: [guacamolePlugin(), react()],
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
        proxy: {
            "/api": "http://localhost:6989",
        }
    }
});
