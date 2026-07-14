const parseResizeMessage = (message) => {
    if (!message.startsWith?.("\x01")) return null;

    const resizeData = message.substring(1);
    if (!resizeData.includes(",")) return null;

    const [width, height] = resizeData.split(",").map(Number);
    if (isNaN(width) || isNaN(height)) return null;

    return { width, height };
};

module.exports = { parseResizeMessage };