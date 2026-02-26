const flatbuffers = require("flatbuffers");
const {
    MessageType,
    Envelope,
    EngineHelloAck,
    Ping,
    Pong,
    SessionOpen,
    SessionClose,
    SessionJoin,
    SessionResize,
    ConnectionParam,
    ExecCommand,
} = require("../generated/control_plane_generated");
const packageJson = require("../../../package.json");

const finishEnvelope = (builder, envOff) => {
    Envelope.finishEnvelopeBuffer(builder, envOff);
    return builder.asUint8Array();
};

const buildConnectionParams = (builder, params, vectorOwner = SessionOpen) => {
    const offsets = [];
    for (const [key, value] of Object.entries(params)) {
        if (value == null) continue;
        const kOff = builder.createString(key);
        const vOff = builder.createString(String(value));
        ConnectionParam.startConnectionParam(builder);
        ConnectionParam.addKey(builder, kOff);
        ConnectionParam.addValue(builder, vOff);
        offsets.push(ConnectionParam.endConnectionParam(builder));
    }
    return offsets.length > 0
        ? vectorOwner.createParamsVector(builder, offsets)
        : 0;
};

const buildEngineHelloAck = (accepted) => {
    const builder = new flatbuffers.Builder(256);
    const versionOff = builder.createString(packageJson.version);

    EngineHelloAck.startEngineHelloAck(builder);
    EngineHelloAck.addAccepted(builder, accepted);
    EngineHelloAck.addServerVersion(builder, versionOff);
    const ackOff = EngineHelloAck.endEngineHelloAck(builder);

    Envelope.startEnvelope(builder);
    Envelope.addMsgType(builder, MessageType.EngineHelloAck);
    Envelope.addEngineHelloAck(builder, ackOff);
    return finishEnvelope(builder, Envelope.endEnvelope(builder));
};

const buildPong = (timestamp) => {
    const builder = new flatbuffers.Builder(64);
    const pongOff = Pong.createPong(builder, timestamp);

    Envelope.startEnvelope(builder);
    Envelope.addMsgType(builder, MessageType.Pong);
    Envelope.addPong(builder, pongOff);
    return finishEnvelope(builder, Envelope.endEnvelope(builder));
};

const buildPing = () => {
    const builder = new flatbuffers.Builder(64);
    Ping.startPing(builder);
    Ping.addTimestamp(builder, BigInt(Date.now()));
    const pingOff = Ping.endPing(builder);

    Envelope.startEnvelope(builder);
    Envelope.addMsgType(builder, MessageType.Ping);
    Envelope.addPing(builder, pingOff);
    return finishEnvelope(builder, Envelope.endEnvelope(builder));
};

const buildSessionOpen = (sessionId, sessionType, host, port, params) => {
    const builder = new flatbuffers.Builder(512);
    const sidOff = builder.createString(sessionId);
    const hostOff = builder.createString(host);
    const paramsVecOff = buildConnectionParams(builder, params);

    SessionOpen.startSessionOpen(builder);
    SessionOpen.addSessionId(builder, sidOff);
    SessionOpen.addSessionType(builder, sessionType);
    SessionOpen.addHost(builder, hostOff);
    SessionOpen.addPort(builder, port);
    if (paramsVecOff) SessionOpen.addParams(builder, paramsVecOff);
    const openOff = SessionOpen.endSessionOpen(builder);

    Envelope.startEnvelope(builder);
    Envelope.addMsgType(builder, MessageType.SessionOpen);
    Envelope.addSessionOpen(builder, openOff);
    return finishEnvelope(builder, Envelope.endEnvelope(builder));
};

const buildSessionClose = (sessionId) => {
    const builder = new flatbuffers.Builder(128);
    const sidOff = builder.createString(sessionId);

    SessionClose.startSessionClose(builder);
    SessionClose.addSessionId(builder, sidOff);
    const closeOff = SessionClose.endSessionClose(builder);

    Envelope.startEnvelope(builder);
    Envelope.addMsgType(builder, MessageType.SessionClose);
    Envelope.addSessionClose(builder, closeOff);
    return finishEnvelope(builder, Envelope.endEnvelope(builder));
};

const buildSessionJoin = (sessionId) => {
    const builder = new flatbuffers.Builder(128);
    const sidOff = builder.createString(sessionId);

    SessionJoin.startSessionJoin(builder);
    SessionJoin.addSessionId(builder, sidOff);
    const joinOff = SessionJoin.endSessionJoin(builder);

    Envelope.startEnvelope(builder);
    Envelope.addMsgType(builder, MessageType.SessionJoin);
    Envelope.addSessionJoin(builder, joinOff);
    return finishEnvelope(builder, Envelope.endEnvelope(builder));
};

const buildSessionResize = (sessionId, cols, rows) => {
    const builder = new flatbuffers.Builder(128);
    const sidOff = builder.createString(sessionId);

    SessionResize.startSessionResize(builder);
    SessionResize.addSessionId(builder, sidOff);
    SessionResize.addCols(builder, cols);
    SessionResize.addRows(builder, rows);
    const resizeOff = SessionResize.endSessionResize(builder);

    Envelope.startEnvelope(builder);
    Envelope.addMsgType(builder, MessageType.SessionResize);
    Envelope.addSessionResize(builder, resizeOff);
    return finishEnvelope(builder, Envelope.endEnvelope(builder));
};

const buildExecCommand = (requestId, host, port, params, command) => {
    const builder = new flatbuffers.Builder(1024);
    const reqIdOff = builder.createString(requestId);
    const hostOff = builder.createString(host);
    const cmdOff = builder.createString(command);
    const paramsVecOff = buildConnectionParams(builder, params, ExecCommand);

    ExecCommand.startExecCommand(builder);
    ExecCommand.addRequestId(builder, reqIdOff);
    ExecCommand.addHost(builder, hostOff);
    ExecCommand.addPort(builder, port);
    if (paramsVecOff) ExecCommand.addParams(builder, paramsVecOff);
    ExecCommand.addCommand(builder, cmdOff);
    const execOff = ExecCommand.endExecCommand(builder);

    Envelope.startEnvelope(builder);
    Envelope.addMsgType(builder, MessageType.ExecCommand);
    Envelope.addExecCommand(builder, execOff);
    return finishEnvelope(builder, Envelope.endEnvelope(builder));
};

module.exports = {
    buildEngineHelloAck,
    buildPong,
    buildPing,
    buildSessionOpen,
    buildSessionClose,
    buildSessionJoin,
    buildSessionResize,
    buildExecCommand,
};
