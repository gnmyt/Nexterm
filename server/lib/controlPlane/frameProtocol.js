const FRAME_HEADER_SIZE = 4;
const MAX_FRAME_SIZE = 16 * 1024 * 1024;

const sendFrame = (socket, payload) => {
    const header = Buffer.alloc(FRAME_HEADER_SIZE);
    header.writeUInt32BE(payload.length, 0);
    socket.write(header);
    socket.write(Buffer.from(payload));
};

const MAX_RECV_BUFFER = MAX_FRAME_SIZE + FRAME_HEADER_SIZE;

const createFrameParser = (onFrame, onInvalidFrame) => {
    let recvBuf = Buffer.alloc(0);
    let aborted = false;

    const fail = (reason) => {
        aborted = true;
        recvBuf = Buffer.alloc(0);
        onInvalidFrame?.(reason);
    };

    const handler = (data) => {
        if (aborted) return;
        recvBuf = Buffer.concat([recvBuf, data]);

        if (recvBuf.length > MAX_RECV_BUFFER) {
            fail(`receive buffer exceeded ${MAX_RECV_BUFFER} bytes`);
            return;
        }

        while (recvBuf.length >= FRAME_HEADER_SIZE) {
            const payloadLen = recvBuf.readUInt32BE(0);

            if (payloadLen === 0 || payloadLen > MAX_FRAME_SIZE) {
                fail(`invalid frame length ${payloadLen}`);
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
