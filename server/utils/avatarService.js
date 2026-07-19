const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const logger = require("./logger");

const AVATARS_DIR = path.join(__dirname, "../../data/avatars");

module.exports.AVATARS_DIR = AVATARS_DIR;
module.exports.MAX_AVATAR_UPLOAD_SIZE = 1024 * 1024;
module.exports.AVATAR_CONTENT_TYPE = "image/webp";

const ensureAvatarsDir = () => {
    if (!fs.existsSync(AVATARS_DIR)) {
        fs.mkdirSync(AVATARS_DIR, { recursive: true });
        logger.system("Created avatars directory", { path: AVATARS_DIR });
    }
};

const getAvatarPath = (accountId) => path.join(AVATARS_DIR, `${Number(accountId)}.webp`);
module.exports.getAvatarPath = getAvatarPath;

module.exports.isWebP = (buffer) =>
    buffer.length > 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF"
    && buffer.subarray(8, 12).toString("ascii") === "WEBP";

module.exports.saveAvatar = (accountId, buffer) => {
    ensureAvatarsDir();
    fs.writeFileSync(getAvatarPath(accountId), buffer);

    return crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16);
};

module.exports.deleteAvatar = (accountId) => {
    const avatarPath = getAvatarPath(accountId);
    if (fs.existsSync(avatarPath)) fs.unlinkSync(avatarPath);
};

module.exports.avatarExists = (accountId) => fs.existsSync(getAvatarPath(accountId));
