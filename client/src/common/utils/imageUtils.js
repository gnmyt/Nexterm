export const AVATAR_SIZE = 256;
export const MAX_AVATAR_INPUT_SIZE = 10 * 1024 * 1024;

const loadImage = (file) => new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
    };
    image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("The selected file could not be read as an image"));
    };
    image.src = objectUrl;
});

export const createSquareAvatar = async (file, size = AVATAR_SIZE) => {
    const image = await loadImage(file);

    const edge = Math.min(image.naturalWidth, image.naturalHeight);
    const sourceX = (image.naturalWidth - edge) / 2;
    const sourceY = (image.naturalHeight - edge) / 2;

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext("2d");
    context.imageSmoothingQuality = "high";
    context.drawImage(image, sourceX, sourceY, edge, edge, 0, 0, size, size);

    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", 0.9));
    if (!blob) throw new Error("The image could not be converted");

    return blob;
};
