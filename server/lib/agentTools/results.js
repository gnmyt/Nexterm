const { truncate } = require("./context");

const isContentResult = (result) => result && typeof result === "object" && Array.isArray(result.content);

const toText = (value) => (typeof value === "string" ? truncate(value) : truncate(JSON.stringify(value, null, 2)));

const textResult = (value) => ({ content: [{ type: "text", text: toText(value) }] });

const errorResult = (message) => ({ isError: true, content: [{ type: "text", text: message }] });

const unpackResult = (result) => {
    if (!isContentResult(result)) return { data: result, images: [] };
    const text = result.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
    const images = result.content.filter((part) => part.type === "image");
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { data, images };
};

const contentToOutput = (result) => {
    const { data, images } = unpackResult(result);
    return {
        ...(data && typeof data === "object" ? data : { text: data }),
        ...(images.length && { images: images.map((image) => ({ data: image.data, mimeType: image.mimeType })) }),
    };
};

const outputToModel = (output) => {
    if (!output || typeof output !== "object" || !Array.isArray(output.images)) return { type: "json", value: output ?? null };
    const { images, ...rest } = output;
    return {
        type: "content",
        value: [
            ...images.map((image) => ({ type: "file", data: { type: "data", data: image.data }, mediaType: image.mimeType })),
            { type: "text", text: JSON.stringify(rest) },
        ],
    };
};

const toPlainJson = (value) => (value === undefined ? null : JSON.parse(JSON.stringify(value)));

module.exports = { isContentResult, textResult, errorResult, unpackResult, contentToOutput, outputToModel, toPlainJson };
