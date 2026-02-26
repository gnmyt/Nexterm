const FRAME_HEADER_SIZE = 4;
const MAX_FRAME_SIZE = 16 * 1024 * 1024;

const sendFrame = (socket, payload) => {
    const header = Buffer.alloc(FRAME_HEADER_SIZE);
    header.writeUInt32BE(payload.length, 0);
    socket.write(header);
    socket.write(Buffer.from(payload));
};

const createFrameParser = (onFrame, onInvalidFrame) => {
    let recvBuf = Buffer.alloc(0);

    const handler = (data) => {
        recvBuf = Buffer.concat([recvBuf, data]);

        while (recvBuf.length >= FRAME_HEADER_SIZE) {
            const payloadLen = recvBuf.readUInt32BE(0);

            if (payloadLen === 0 || payloadLen > MAX_FRAME_SIZE) {
                onInvalidFrame?.(payloadLen);
                return;
            }

            if (recvBuf.length < FRAME_HEADER_SIZE + payloadLen) break;

            const payload = recvBuf.subarray(FRAME_HEADER_SIZE, FRAME_HEADER_SIZE + payloadLen);
            recvBuf = recvBuf.subarray(FRAME_HEADER_SIZE + payloadLen);
            onFrame(payload);
        }
    };

    handler.drain = () => {
        const remaining = recvBuf;
        recvBuf = Buffer.alloc(0);
        return remaining;
    };

    return handler;
};

module.exports = { FRAME_HEADER_SIZE, sendFrame, createFrameParser };
