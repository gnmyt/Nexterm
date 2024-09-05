const AppSource = require("../models/AppSource");
const fs = require("fs");
const axios = require("axios");
const decompress = require("decompress");
const path = require("path");
const yaml = require("js-yaml");
const { appObject } = require("../validations/appSource");

let apps = [];
let refreshTimer;

module.exports.createAppSource = async configuration => {
    const appSource = await AppSource.findOne({ where: { name: configuration.name } });

    if (appSource !== null)
        return { code: 101, message: "This app source already exists" };

    await AppSource.create(configuration);

    await this.refreshAppSources();
};

module.exports.getAppSources = async () => {
    return await AppSource.findAll();
};

module.exports.getAppSource = async name => {
    return await AppSource.findOne({ where: { name } });
};

module.exports.updateAppUrl = async (name, url) => {
    const appSource = await AppSource.findOne({ where: { name } });

    if (appSource === null)
        return { code: 102, message: "This app source does not exist" };


    await AppSource.update({ url }, { where: { name } });
};

module.exports.deleteAppSource = async name => {
    const appSource = await AppSource.findOne({ where: { name } });

    if (appSource === null) {
        return { code: 102, message: "This app source does not exist" };
    }

    fs.rmSync(process.cwd() + "/data/sources/" + appSource.name, { recursive: true });

    await AppSource.destroy({ where: { name } });

    await this.refreshAppSources();
};

const downloadAppSource = async (name, url) => {
    const { data: buffer } = await axios.get(url, { responseType: "arraybuffer" });
    fs.writeFileSync(process.cwd() + `/data/sources/${name}.zip`, buffer);

    return `${process.cwd()}/data/sources/${name}.zip`;
};

const extractNextermFiles = async (zipFilePath, outputDir) => {
    await decompress(zipFilePath, outputDir, {
        filter: file => file.path.endsWith(".nexterm.yml"),
        map: file => {
            file.path = path.basename(file.path);
            return file;
        },
    });
};

const parseAppFile = async (name, sourceFile) => {
    const appFileContent = fs.readFileSync(sourceFile, "utf8");
    const parsedYaml = yaml.load(appFileContent);

    if (parsedYaml && parsedYaml["x-nexterm"]) {
        return parsedYaml["x-nexterm"];
    } else {
        throw new Error("x-nexterm not found in the YAML file");
    }
};

const parseAppSource = async (name, sourceDir) => {
    const files = fs.readdirSync(sourceDir);

    for (const file of files) {
        if (file.endsWith(".nexterm.yml")) {
            const appItem = await parseAppFile(name, sourceDir + "/" + file);
            const { error } = appObject.validate(appItem);

            if (error) {
                const message = error?.details[0].message || "No message provided";
                console.error("Skipping app source due to validation error:", message);

                continue;
            }

            apps.push({ ...appItem, id: name + "/" + file.replace(".nexterm.yml", "") });
        }
    }
};

module.exports.refreshAppSources = async () => {
    const appSources = await AppSource.findAll();

    apps = [];

    for (const appSource of appSources) {
        try {
            const path = await downloadAppSource(appSource.name, appSource.url);

            if (fs.existsSync(process.cwd() + "/data/sources/" + appSource.name)) {
                fs.rmSync(process.cwd() + "/data/sources/" + appSource.name, { recursive: true });
            }

            fs.mkdirSync(process.cwd() + "/data/sources/" + appSource.name);

            await extractNextermFiles(path, process.cwd() + "/data/sources/" + appSource.name);

            await fs.promises.unlink(path)
                .catch(err => console.error("Error deleting downloaded file:", err));

            await parseAppSource(appSource.name, process.cwd() + "/data/sources/" + appSource.name);
        } catch (err) {
            console.error(`Error refreshing app source ${appSource.name}:`, err.message);
        }
    }

    console.log("Refreshed app sources");
};

module.exports.startAppUpdater = async () => {
    refreshTimer = setInterval(async () => {
        await this.refreshAppSources();
    }, 1000 * 60 * 60 * 24);
};

module.exports.stopAppUpdater = () => clearInterval(refreshTimer);

module.exports.getApps = () => apps;

module.exports.getApp = async (id) => {
    const app = apps.find(app => app.id === id);
    if (!app) return null;

    return app;
};

module.exports.getComposeFile = (id) => {
    const app = apps.find(app => app.id === id);
    if (!app) return null;

    const source = app.id.split("/")[0];
    const folder = app.id.split("/")[1];

    return fs.readFileSync(process.cwd() + `/data/sources/${source}/${folder}.nexterm.yml`, "utf8");
};

module.exports.getAppsByCategory = async (category) => {
    return apps.filter(app => app.category === category);
};

module.exports.searchApp = async (search) => {
    return apps.filter(app => app.name.toLowerCase().includes(search.toLowerCase()));
};