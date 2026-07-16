export const E_NOENT = 1;
export const E_ACCES = 2;
export const E_EXIST = 3;
export const E_INVAL = 7;
export const E_NOSYS = 8;
export const E_IO = 9;

export class FsError extends Error {

    constructor(code, message) {
        super(message);
        this.name = "FsError";
        this.code = code;
    }
}
