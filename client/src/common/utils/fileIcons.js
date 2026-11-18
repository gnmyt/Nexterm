import {
    mdiAccountGroup, mdiApplicationCog, mdiBookOpenVariant, mdiCertificate, mdiChip, mdiConsole, mdiDatabase,
    mdiDisc, mdiEmail, mdiFile, mdiFileCode, mdiFileCog, mdiFileCompare, mdiFileDelimited, mdiFileDocumentOutline,
    mdiFileExcelBox, mdiFileImage, mdiFileLock, mdiFileMusic, mdiFilePdfBox, mdiFilePowerpointBox, mdiFileVideo,
    mdiFileWordBox, mdiFolder, mdiFolderClock, mdiFolderCog, mdiFolderDownload, mdiFolderHome, mdiFolderImage,
    mdiFolderKey, mdiFolderMusic, mdiFolderNetwork, mdiFolderOpen, mdiFolderPlay, mdiFolderRemove, mdiFolderText,
    mdiFolderWrench, mdiFormatFont, mdiHammerWrench, mdiHandshake, mdiHarddisk, mdiHistory, mdiKey, mdiKeyVariant,
    mdiLanguageCsharp, mdiLock, mdiMicrosoftWindows, mdiPackageVariant, mdiPowershell, mdiRobot, mdiScaleBalance,
    mdiShieldLock, mdiSvg, mdiTestTube, mdiTextLong, mdiXml, mdiZipBox, mdiCalendar,
} from "@mdi/js";
import {
    siAndroid, siApache, siApachemaven, siApple, siBun, siC, siClojure, siCmake, siCplusplus, siCrystal, siCss,
    siDart, siDebian, siDeno, siDocker, siDotenv, siDotnet, siEditorconfig, siElixir, siErlang, siEslint, siGit,
    siGitlab, siGnubash, siGo, siGradle, siGraphql, siHaskell, siHtml5, siJavascript, siJenkins, siJson, siJulia,
    siJupyter, siKotlin, siLatex, siLess, siLinux, siLua, siMarkdown, siMdx, siNginx, siNim, siNixos, siNodedotjs,
    siNpm, siOcaml, siOpenjdk, siPerl, siPhp, siPnpm, siPrettier, siPython, siR, siReact, siRuby, siRust, siSass,
    siScala, siSolidity, siSqlite, siSvelte, siSwift, siTailwindcss, siTerraform, siToml, siTypescript, siVagrant,
    siVim, siVite, siVuedotjs, siWebassembly, siYaml, siYarn, siZig,
} from "simple-icons";

const C = {
    red: "#E5534B", orange: "#E8833A", amber: "#D29922", green: "#57AB5A", teal: "#2EA8A0",
    cyan: "#39A0D0", blue: "#4C8DF6", indigo: "#7A7FE8", purple: "#A371F7", pink: "#DB61A2",
    docker: "#2496ED", git: "#F05033", neutral: null,
};

const brand = (icon, color) => ({ path: icon.path, color, brand: true });
const glyph = (path, color = C.neutral) => ({ path, color, brand: false });

const ICON = {
    javascript: brand(siJavascript, C.amber),
    typescript: brand(siTypescript, C.blue),
    react: brand(siReact, C.cyan),
    vue: brand(siVuedotjs, C.green),
    svelte: brand(siSvelte, C.orange),
    python: brand(siPython, C.blue),
    jupyter: brand(siJupyter, C.orange),
    rust: brand(siRust, C.orange),
    go: brand(siGo, C.cyan),
    java: brand(siOpenjdk, C.orange),
    kotlin: brand(siKotlin, C.purple),
    gradle: brand(siGradle, C.teal),
    maven: brand(siApachemaven, C.red),
    markdown: brand(siMarkdown, C.blue),
    mdx: brand(siMdx, C.amber),
    yaml: brand(siYaml, C.red),
    json: brand(siJson, C.amber),
    toml: brand(siToml, C.orange),
    shell: brand(siGnubash, C.green),
    c: brand(siC, C.blue),
    cpp: brand(siCplusplus, C.blue),
    csharp: glyph(mdiLanguageCsharp, C.purple),
    dotnet: brand(siDotnet, C.purple),
    html: brand(siHtml5, C.orange),
    css: brand(siCss, C.blue),
    sass: brand(siSass, C.pink),
    less: brand(siLess, C.indigo),
    php: brand(siPhp, C.indigo),
    ruby: brand(siRuby, C.red),
    swift: brand(siSwift, C.orange),
    lua: brand(siLua, C.indigo),
    dart: brand(siDart, C.cyan),
    elixir: brand(siElixir, C.purple),
    haskell: brand(siHaskell, C.purple),
    scala: brand(siScala, C.red),
    perl: brand(siPerl, C.cyan),
    r: brand(siR, C.blue),
    zig: brand(siZig, C.orange),
    nix: brand(siNixos, C.cyan),
    julia: brand(siJulia, C.purple),
    ocaml: brand(siOcaml, C.orange),
    clojure: brand(siClojure, C.green),
    erlang: brand(siErlang, C.red),
    crystal: brand(siCrystal, C.neutral),
    nim: brand(siNim, C.amber),
    solidity: brand(siSolidity, C.neutral),
    terraform: brand(siTerraform, C.purple),
    graphql: brand(siGraphql, C.pink),
    sqlite: brand(siSqlite, C.cyan),
    latex: brand(siLatex, C.teal),
    vim: brand(siVim, C.green),
    wasm: brand(siWebassembly, C.indigo),
    docker: brand(siDocker, C.docker),
    git: brand(siGit, C.git),
    gitlab: brand(siGitlab, C.orange),
    npm: brand(siNpm, C.red),
    yarn: brand(siYarn, C.cyan),
    pnpm: brand(siPnpm, C.orange),
    bun: brand(siBun, C.neutral),
    deno: brand(siDeno, C.neutral),
    node: brand(siNodedotjs, C.green),
    vite: brand(siVite, C.purple),
    eslint: brand(siEslint, C.indigo),
    prettier: brand(siPrettier, C.amber),
    tailwind: brand(siTailwindcss, C.cyan),
    editorconfig: brand(siEditorconfig, C.neutral),
    dotenv: brand(siDotenv, C.amber),
    cmake: brand(siCmake, C.blue),
    nginx: brand(siNginx, C.green),
    apache: brand(siApache, C.red),
    jenkins: brand(siJenkins, C.red),
    vagrant: brand(siVagrant, C.blue),
    debian: brand(siDebian, C.red),
    android: brand(siAndroid, C.green),
    apple: brand(siApple, C.neutral),
    linux: brand(siLinux, C.amber),

    powershell: glyph(mdiPowershell, C.blue),
    batch: glyph(mdiConsole, C.indigo),
    executable: glyph(mdiConsole, C.green),
    windows: glyph(mdiMicrosoftWindows, C.blue),
    package: glyph(mdiPackageVariant, C.orange),
    disc: glyph(mdiDisc),
    disk: glyph(mdiHarddisk),
    binary: glyph(mdiChip),
    archive: glyph(mdiZipBox, C.amber),
    image: glyph(mdiFileImage, C.purple),
    svg: glyph(mdiSvg, C.orange),
    audio: glyph(mdiFileMusic, C.green),
    video: glyph(mdiFileVideo, C.orange),
    pdf: glyph(mdiFilePdfBox, C.red),
    word: glyph(mdiFileWordBox, C.blue),
    excel: glyph(mdiFileExcelBox, C.green),
    powerpoint: glyph(mdiFilePowerpointBox, C.orange),
    table: glyph(mdiFileDelimited, C.green),
    text: glyph(mdiFileDocumentOutline),
    log: glyph(mdiTextLong),
    privateKey: glyph(mdiKeyVariant, C.amber),
    publicKey: glyph(mdiKey, C.green),
    certificate: glyph(mdiCertificate, C.teal),
    encrypted: glyph(mdiFileLock, C.teal),
    config: glyph(mdiFileCog),
    xml: glyph(mdiXml, C.orange),
    lock: glyph(mdiLock),
    diff: glyph(mdiFileCompare, C.green),
    font: glyph(mdiFormatFont, C.red),
    database: glyph(mdiDatabase, C.orange),
    email: glyph(mdiEmail, C.blue),
    calendar: glyph(mdiCalendar, C.blue),
    backup: glyph(mdiHistory),
    service: glyph(mdiApplicationCog, C.teal),
    code: glyph(mdiFileCode, C.blue),
    test: glyph(mdiTestTube, C.green),
    make: glyph(mdiHammerWrench, C.orange),
    license: glyph(mdiScaleBalance, C.amber),
    readme: glyph(mdiBookOpenVariant, C.blue),
    changelog: glyph(mdiHistory, C.green),
    contributing: glyph(mdiAccountGroup, C.blue),
    conduct: glyph(mdiHandshake, C.blue),
    security: glyph(mdiShieldLock, C.red),
    robots: glyph(mdiRobot),
    file: glyph(mdiFile),
};

const group = (icon, keys) => Object.fromEntries(keys.map(k => [k, icon]));
const table = (entries) => Object.assign(Object.create(null), entries);

const BY_EXTENSION = table({
    ...group(ICON.javascript, ["js", "mjs", "cjs"]),
    ...group(ICON.typescript, ["ts", "mts", "cts"]),
    ...group(ICON.react, ["jsx", "tsx"]),
    vue: ICON.vue, svelte: ICON.svelte,
    ...group(ICON.python, ["py", "pyw", "pyi", "pyx"]),
    ipynb: ICON.jupyter,
    rs: ICON.rust, go: ICON.go,
    ...group(ICON.java, ["java", "jar", "class", "war"]),
    ...group(ICON.kotlin, ["kt", "kts"]),
    gradle: ICON.gradle,
    ...group(ICON.markdown, ["md", "markdown"]),
    mdx: ICON.mdx,
    ...group(ICON.yaml, ["yml", "yaml"]),
    ...group(ICON.json, ["json", "jsonc", "json5", "jsonl"]),
    toml: ICON.toml,
    ...group(ICON.shell, ["sh", "bash", "zsh", "fish", "ksh", "csh"]),
    ...group(ICON.c, ["c", "h"]),
    ...group(ICON.cpp, ["cpp", "cc", "cxx", "hpp", "hh", "hxx", "ino"]),
    cs: ICON.csharp,
    ...group(ICON.dotnet, ["sln", "csproj", "fsproj", "vbproj", "fs"]),
    ...group(ICON.html, ["html", "htm", "xhtml"]),
    css: ICON.css,
    ...group(ICON.sass, ["scss", "sass"]),
    less: ICON.less, php: ICON.php,
    ...group(ICON.ruby, ["rb", "erb", "gemspec", "rake"]),
    swift: ICON.swift, lua: ICON.lua, dart: ICON.dart,
    ...group(ICON.elixir, ["ex", "exs"]),
    hs: ICON.haskell,
    ...group(ICON.scala, ["scala", "sc"]),
    ...group(ICON.perl, ["pl", "pm"]),
    r: ICON.r, zig: ICON.zig, nix: ICON.nix, jl: ICON.julia,
    ...group(ICON.ocaml, ["ml", "mli"]),
    ...group(ICON.clojure, ["clj", "cljs", "edn"]),
    erl: ICON.erlang, cr: ICON.crystal, nim: ICON.nim, sol: ICON.solidity,
    ...group(ICON.terraform, ["tf", "tfvars", "hcl"]),
    ...group(ICON.graphql, ["graphql", "gql"]),
    ...group(ICON.sqlite, ["sqlite", "sqlite3", "db"]),
    sql: ICON.database,
    ...group(ICON.latex, ["tex", "bib", "sty"]),
    vim: ICON.vim, wasm: ICON.wasm,
    ...group(ICON.powershell, ["ps1", "psm1", "psd1"]),
    ...group(ICON.batch, ["bat", "cmd"]),
    ...group(ICON.windows, ["exe", "msi", "dll", "lnk"]),
    deb: ICON.debian, rpm: ICON.package, apk: ICON.android, aab: ICON.android,
    ...group(ICON.apple, ["dmg", "pkg", "ipa"]),
    appimage: ICON.linux,
    ...group(ICON.disc, ["iso", "img"]),
    ...group(ICON.disk, ["vmdk", "qcow2", "vdi", "vhd", "vhdx", "ova", "ovf"]),
    ...group(ICON.binary, ["bin", "so", "o", "a", "ko", "elf", "dylib"]),
    ...group(ICON.archive, ["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "tbz2", "xz", "txz", "zst", "lz4", "lzma", "cab"]),
    ...group(ICON.image, ["jpg", "jpeg", "png", "gif", "bmp", "webp", "ico", "tif", "tiff", "heic", "avif", "psd", "xcf", "raw"]),
    svg: ICON.svg,
    ...group(ICON.audio, ["mp3", "wav", "flac", "ogg", "oga", "m4a", "aac", "opus", "wma"]),
    ...group(ICON.video, ["mp4", "avi", "mov", "mkv", "webm", "wmv", "flv", "m4v", "mpeg", "mpg"]),
    pdf: ICON.pdf,
    ...group(ICON.word, ["doc", "docx", "odt", "rtf"]),
    ...group(ICON.excel, ["xls", "xlsx", "ods"]),
    ...group(ICON.powerpoint, ["ppt", "pptx", "odp"]),
    ...group(ICON.table, ["csv", "tsv"]),
    ...group(ICON.text, ["txt", "text", "rst", "adoc", "nfo"]),
    log: ICON.log,
    ...group(ICON.privateKey, ["pem", "key", "ppk", "jks", "keystore"]),
    pub: ICON.publicKey,
    ...group(ICON.certificate, ["crt", "cer", "csr", "der", "p12", "pfx", "p7b"]),
    ...group(ICON.encrypted, ["gpg", "asc", "sig", "kdbx"]),
    ...group(ICON.config, ["ini", "cfg", "conf", "config", "properties", "env", "rc", "desktop", "reg"]),
    ...group(ICON.xml, ["xml", "plist", "xsd", "xsl", "wsdl"]),
    lock: ICON.lock,
    ...group(ICON.diff, ["diff", "patch"]),
    ...group(ICON.font, ["ttf", "otf", "woff", "woff2", "eot"]),
    ...group(ICON.email, ["eml", "msg", "mbox"]),
    ics: ICON.calendar,
    ...group(ICON.backup, ["bak", "old", "orig", "swp", "tmp"]),
    ...group(ICON.service, ["service", "timer", "socket", "target", "mount"]),
    ...group(ICON.code, ["asm", "s", "v", "sv", "f90", "pas", "groovy"]),
    cmake: ICON.cmake,
});

const BY_COMPOUND_EXTENSION = table({
    "d.ts": ICON.typescript,
    "gradle.kts": ICON.gradle,
    ...group(ICON.archive, ["tar.gz", "tar.xz", "tar.bz2", "tar.zst", "tar.lz4"]),
});

const BY_FILENAME = table({
    ...group(ICON.docker, ["containerfile", ".dockerignore"]),
    ...group(ICON.git, [".gitignore", ".gitattributes", ".gitmodules", ".gitkeep", ".gitconfig", ".mailmap", ".git-blame-ignore-revs"]),
    ".gitlab-ci.yml": ICON.gitlab,
    ...group(ICON.make, ["makefile", "gnumakefile", "justfile", "taskfile.yml"]),
    "cmakelists.txt": ICON.cmake,
    ...group(ICON.npm, ["package.json", "package-lock.json", ".npmrc", ".npmignore"]),
    ...group(ICON.yarn, ["yarn.lock", ".yarnrc", ".yarnrc.yml"]),
    ...group(ICON.pnpm, ["pnpm-lock.yaml", "pnpm-workspace.yaml"]),
    ...group(ICON.bun, ["bun.lockb", "bun.lock", "bunfig.toml"]),
    ...group(ICON.deno, ["deno.json", "deno.jsonc", "deno.lock"]),
    ...group(ICON.node, [".nvmrc", ".node-version"]),
    ...group(ICON.typescript, ["tsconfig.json", "jsconfig.json"]),
    ".editorconfig": ICON.editorconfig,
    ...group(ICON.rust, ["cargo.toml", "cargo.lock", "rust-toolchain", "rust-toolchain.toml"]),
    ...group(ICON.go, ["go.mod", "go.sum", "go.work"]),
    ...group(ICON.ruby, ["gemfile", "gemfile.lock", "rakefile", ".ruby-version"]),
    ...group(ICON.python, ["requirements.txt", "pyproject.toml", "pipfile", "pipfile.lock", "setup.py", "setup.cfg", "poetry.lock", ".python-version"]),
    "pom.xml": ICON.maven,
    ...group(ICON.gradle, ["gradlew", "gradlew.bat", "gradle.properties"]),
    "nginx.conf": ICON.nginx,
    ".htaccess": ICON.apache,
    jenkinsfile: ICON.jenkins,
    vagrantfile: ICON.vagrant,
    ...group(ICON.vim, [".vimrc", ".gvimrc", ".viminfo"]),
    ...group(ICON.shell, [".bashrc", ".bash_profile", ".bash_login", ".bash_logout", ".bash_aliases", ".profile", ".zshrc", ".zprofile", ".zshenv", ".inputrc"]),
    ...group(ICON.backup, [".bash_history", ".zsh_history", ".python_history", ".lesshst", ".node_repl_history"]),
    ...group(ICON.privateKey, ["id_rsa", "id_ed25519", "id_ecdsa", "id_dsa", "id_ed25519_sk", "id_ecdsa_sk"]),
    ...group(ICON.publicKey, ["authorized_keys", "authorized_keys2", "known_hosts", "known_hosts.old"]),
    ...group(ICON.security, ["passwd", "shadow", "gshadow", "sudoers", "group"]),
    ...group(ICON.config, ["hosts", "fstab", "crontab", "hostname", "resolv.conf", "ssh_config", "sshd_config", "environment"]),
    "robots.txt": ICON.robots,
});

const BY_PREFIX = [
    ["readme", ICON.readme], ["license", ICON.license], ["licence", ICON.license], ["copying", ICON.license],
    ["changelog", ICON.changelog], ["changes", ICON.changelog], ["history.md", ICON.changelog],
    ["contributing", ICON.contributing], ["code_of_conduct", ICON.conduct], ["security", ICON.security],
    ["dockerfile", ICON.docker], ["docker-compose", ICON.docker], ["compose.", ICON.docker],
    [".env", ICON.dotenv], ["vite.config", ICON.vite], ["vitest.config", ICON.vite],
    [".eslintrc", ICON.eslint], ["eslint.config", ICON.eslint],
    [".prettierrc", ICON.prettier], ["prettier.config", ICON.prettier],
    ["tailwind.config", ICON.tailwind],
];

const TEST_PATTERN = /\.(test|spec)\.[cm]?[jt]sx?$/;

const FOLDERS = table({
    ...group(mdiFolderHome, ["home", "root", "users"]),
    ...group(mdiFolderDownload, ["downloads"]),
    ...group(mdiFolderText, ["documents", "docs", "doc"]),
    ...group(mdiFolderImage, ["pictures", "images", "img", "photos"]),
    ...group(mdiFolderMusic, ["music", "audio"]),
    ...group(mdiFolderPlay, ["videos", "movies"]),
    ...group(mdiFolderKey, [".ssh", ".gnupg", "ssl", "certs", "keys", "secrets"]),
    ...group(mdiFolderCog, ["etc", ".config", "config", ".vscode", ".idea", ".github", ".gitlab", ".git"]),
    ...group(mdiFolderClock, ["tmp", "temp", ".cache", "cache", "log", "logs"]),
    ...group(mdiFolderWrench, ["dist", "build", "out", "target"]),
    ...group(mdiFolderNetwork, ["public", "www", "html", "srv"]),
    ...group(mdiFolderRemove, [".trash", "trash"]),
});

const extensionOf = (lower) => {
    const dot = lower.lastIndexOf(".");
    return dot > 0 ? lower.slice(dot + 1) : null;
};

const compoundExtensionOf = (lower) => {
    const parts = lower.split(".");
    return parts.length > 2 ? parts.slice(-2).join(".") : null;
};

const isExecutable = (item) => typeof item.mode === "number" && (item.mode & 0o111) !== 0;

export const getFileIcon = (item, { expanded = false } = {}) => {
    const lower = item.name.toLowerCase();

    if (item.type === "folder") {
        return glyph(FOLDERS[lower] ?? (expanded ? mdiFolderOpen : mdiFolder));
    }

    if (BY_FILENAME[lower]) return BY_FILENAME[lower];
    if (TEST_PATTERN.test(lower)) return ICON.test;

    const compound = compoundExtensionOf(lower);
    if (compound && BY_COMPOUND_EXTENSION[compound]) return BY_COMPOUND_EXTENSION[compound];

    const prefixMatch = BY_PREFIX.find(([prefix]) => lower.startsWith(prefix));
    if (prefixMatch) return prefixMatch[1];

    const ext = extensionOf(lower);
    if (ext && BY_EXTENSION[ext]) return BY_EXTENSION[ext];

    if (!ext && isExecutable(item)) return ICON.executable;

    return ICON.file;
};
