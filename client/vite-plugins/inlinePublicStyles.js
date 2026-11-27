import fs from "node:fs";
import path from "node:path";

export const inlinePublicStyles = () => {
    let publicDir;
    return {
        name: "nexterm-inline-public-styles",
        configResolved(config) {
            publicDir = config.publicDir;
        },
        transformIndexHtml(html) {
            const rules = [];
            const rest = html.replace(/[ \t]*<link rel="stylesheet" href="(\/[^"]+\.css)"\s*\/?>\n?/g, (link, href) => {
                const file = path.join(publicDir, href);
                if (!fs.existsSync(file)) return link;
                const folder = path.posix.dirname(href);
                rules.push(fs.readFileSync(file, "utf8")
                    .replace(/url\((['"]?)\.\//g, `url($1${folder}/`)
                    .replace(/\s+/g, " ").trim());
                return "";
            });
            return rules.length ? rest.replace("</head>", `  <style>${rules.join(" ")}</style>\n  </head>`) : html;
        },
    };
};
