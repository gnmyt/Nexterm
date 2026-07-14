import { useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import {
    mdiRobotHappyOutline, mdiSend, mdiStop, mdiClose,
    mdiCheck, mdiCancel, mdiConsoleLine, mdiFileDocumentOutline, mdiFileEditOutline, mdiFolderOutline,
    mdiInformationOutline, mdiFolderPlusOutline, mdiTrashCanOutline, mdiFileMoveOutline, mdiLockOutline, mdiMagnify,
} from "@mdi/js";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { useKeymaps, matchesKeybind } from "@/common/contexts/KeymapContext.jsx";
import Button from "@/common/components/Button";
import FloatingWindow from "@/common/components/FloatingWindow";
import { getWebSocketUrl } from "@/common/utils/ConnectionUtil.js";
import MessageContent from "./components/MessageContent";
import "./styles.sass";

const TOOL_META = {
    runCommand: { icon: mdiConsoleLine, summary: (a) => a.command },
    readFile: { icon: mdiFileDocumentOutline, summary: (a) => a.path },
    writeFile: { icon: mdiFileEditOutline, summary: (a) => a.path },
    editFile: { icon: mdiFileEditOutline, summary: (a) => a.path },
    listDirectory: { icon: mdiFolderOutline, summary: (a) => a.path },
    statPath: { icon: mdiInformationOutline, summary: (a) => a.path },
    makeDirectory: { icon: mdiFolderPlusOutline, summary: (a) => a.path },
    deleteFile: { icon: mdiTrashCanOutline, summary: (a) => a.path },
    removeDirectory: { icon: mdiTrashCanOutline, summary: (a) => (a.recursive ? `${a.path} (recursive)` : a.path) },
    movePath: { icon: mdiFileMoveOutline, summary: (a) => `${a.source} → ${a.destination}` },
    changePermissions: { icon: mdiLockOutline, summary: (a) => `${a.path} → ${a.mode}` },
    findDirectories: { icon: mdiMagnify, summary: (a) => a.query },
};

const ToolResult = ({ tool, result }) => {
    if (!result || result.denied) return null;

    if (tool === "runCommand") {
        return (
            <div className="tool-result">
                {result.stdout ? <pre className="output">{result.stdout}</pre> : null}
                {result.stderr ? <pre className="output stderr">{result.stderr}</pre> : null}
            </div>
        );
    }

    if (tool === "readFile") {
        return (
            <div className="tool-result">
                <pre className="output">{result.content}{result.truncated ? "\n… [truncated]" : ""}</pre>
            </div>
        );
    }

    if (tool === "listDirectory") {
        return (
            <div className="tool-result dir-list">
                {(result.entries || []).map((e, i) => (
                    <span key={i} className={`dir-entry ${e.type}`}>{e.name}{e.type === "folder" ? "/" : ""}</span>
                ))}
            </div>
        );
    }

    return (
        <div className="tool-result">
            <pre className="output">{JSON.stringify(result, null, 2)}</pre>
        </div>
    );
};

const ToolCard = ({ message, onConfirm, acceptHint }) => {
    const { t } = useTranslation();
    const meta = TOOL_META[message.tool] || { icon: mdiConsoleLine, summary: () => "" };
    const summary = meta.summary(message.args || {});
    const exitCode = message.tool === "runCommand" && message.status === "done" && message.result && !message.result.denied
        ? message.result.exitCode : null;
    const failed = exitCode !== null && exitCode !== 0;

    return (
        <div className={`tool-card status-${message.status}${failed ? " exit-failed" : ""}`}>
            <div className="tool-head">
                <Icon path={meta.icon} />
                <span className="tool-name">{t(`servers.aiAssistant.tools.${message.tool}`)}</span>
                <span className="tool-status">
                    {message.status === "running" && <span className="ai-spinner" />}
                    {message.status === "done" && (failed
                        ? <span className="tool-exit fail">exit {exitCode}</span>
                        : <Icon path={mdiCheck} />)}
                    {message.status === "denied" && <Icon path={mdiCancel} />}
                    {message.status === "aborted" && <Icon path={mdiStop} />}
                    {message.status === "error" && <Icon path={mdiClose} />}
                </span>
            </div>

            {summary && <div className="tool-target">{summary}</div>}

            {message.status === "awaiting-confirm" && (
                <div className="tool-confirm">
                    <span>{t("servers.aiAssistant.confirmPrompt")}</span>
                    <div className="confirm-actions">
                        <Button type="danger" icon={mdiCancel} text={t("servers.aiAssistant.deny")}
                                onClick={() => onConfirm(message.callId, false)} />
                        <Button icon={mdiCheck} text={t("servers.aiAssistant.allow")}
                                title={acceptHint ? t("servers.aiAssistant.allowShortcut", { key: acceptHint }) : undefined}
                                onClick={() => onConfirm(message.callId, true)} />
                    </div>
                    {acceptHint && <span className="confirm-hint">{t("servers.aiAssistant.allowShortcut", { key: acceptHint })}</span>}
                </div>
            )}

            {message.status === "denied" && <div className="tool-note">{t("servers.aiAssistant.denied")}</div>}
            {message.status === "aborted" && <div className="tool-note">{t("servers.aiAssistant.stopped")}</div>}
            {message.status === "error" && <div className="tool-note error">{message.error}</div>}
            {(message.status === "done") && <ToolResult tool={message.tool} result={message.result} />}
        </div>
    );
};

export const AIAssistant = ({ session, onClose }) => {
    const { t } = useTranslation();
    const { sessionToken } = useContext(UserContext);
    const { getParsedKeybind, getKeybind, formatKey } = useKeymaps();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [running, setRunning] = useState(false);
    const [ready, setReady] = useState(false);
    const [connectionError, setConnectionError] = useState(null);
    const wsRef = useRef(null);
    const messagesRef = useRef(null);
    const inputRef = useRef(null);

    const appendAssistant = (delta) => {
        setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === "assistant" && last.streaming) {
                return [...prev.slice(0, -1), { ...last, text: last.text + delta }];
            }
            return [...prev, { role: "assistant", text: delta, streaming: true }];
        });
    };

    const upsertTool = (callId, patch, base) => {
        setMessages((prev) => {
            const idx = prev.findIndex((m) => m.role === "tool" && m.callId === callId);
            if (idx === -1) {
                if (!base) return prev;
                return [...prev, { role: "tool", callId, ...base, ...patch }];
            }
            const next = [...prev];
            next[idx] = { ...next[idx], ...patch };
            return next;
        });
    };

    const stopStreaming = () => {
        setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === "assistant" && last.streaming) {
                return [...prev.slice(0, -1), { ...last, streaming: false }];
            }
            return prev;
        });
    };

    const finalizeRunningTools = () => {
        setMessages((prev) => prev.map((m) => (
            m.role === "tool" && (m.status === "running" || m.status === "awaiting-confirm")
                ? { ...m, status: "aborted" } : m
        )));
    };

    useEffect(() => {
        if (!sessionToken) return;

        let closedByUs = false;
        setConnectionError(null);

        const ws = new WebSocket(getWebSocketUrl("/api/ws/ai", { sessionToken, sessionId: session.id }));
        wsRef.current = ws;

        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            switch (msg.type) {
                case "ready": setReady(true); setConnectionError(null); break;
                case "text-delta": appendAssistant(msg.delta); break;
                case "tool-call":
                    stopStreaming();
                    upsertTool(msg.callId, {}, { tool: msg.tool, args: msg.args, status: "running" });
                    break;
                case "confirm-request":
                    upsertTool(msg.callId, { status: "awaiting-confirm", tool: msg.tool, args: msg.args },
                        { tool: msg.tool, args: msg.args, status: "awaiting-confirm" });
                    break;
                case "tool-result":
                    upsertTool(msg.callId, { status: msg.result?.denied ? "denied" : "done", result: msg.result });
                    break;
                case "tool-error":
                    upsertTool(msg.callId, { status: "error", error: msg.error });
                    break;
                case "done": stopStreaming(); setRunning(false); break;
                case "aborted": stopStreaming(); finalizeRunningTools(); setRunning(false); break;
                case "error":
                    stopStreaming(); setRunning(false);
                    setMessages((prev) => [...prev, { role: "system", text: msg.message }]);
                    break;
                default: break;
            }
        };

        ws.onclose = (event) => {
            if (closedByUs) return;
            setReady(false);
            setRunning(false);
            if (event.code >= 4000 && event.reason) setConnectionError(event.reason);
            else if (event.code !== 1000 && event.code !== 1005) setConnectionError(t("servers.aiAssistant.connectionError"));
        };
        ws.onerror = () => {
            if (!closedByUs) setReady(false);
        };

        return () => {
            closedByUs = true;
            ws.onmessage = null;
            ws.onclose = null;
            ws.onerror = null;
            ws.close();
        };
    }, [sessionToken, session.id]);

    useEffect(() => {
        messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight });
    }, [messages]);

    useEffect(() => {
        if (ready) inputRef.current?.focus();
    }, [ready]);

    const sendPrompt = () => {
        const content = input.trim();
        if (!content || running || !ready) return;
        wsRef.current?.send(JSON.stringify({ type: "prompt", content }));
        setMessages((prev) => [...prev, { role: "user", text: content }]);
        setInput("");
        setRunning(true);
    };

    const stop = () => {
        wsRef.current?.send(JSON.stringify({ type: "abort" }));
        stopStreaming();
        finalizeRunningTools();
        setRunning(false);
    };

    const confirmTool = (callId, allow) => {
        wsRef.current?.send(JSON.stringify({ type: "confirm", callId, allow }));
        upsertTool(callId, { status: allow ? "running" : "denied" });
    };

    const pendingConfirmId = messages.find((m) => m.role === "tool" && m.status === "awaiting-confirm")?.callId ?? null;
    const acceptKeybind = getParsedKeybind?.("ai-accept-tool");
    const acceptHint = formatKey?.(getKeybind?.("ai-accept-tool"));

    useEffect(() => {
        if (!pendingConfirmId || !acceptKeybind) return;

        const handleAcceptShortcut = (e) => {
            if (!matchesKeybind(e, acceptKeybind)) return;
            e.preventDefault();
            e.stopPropagation();
            confirmTool(pendingConfirmId, true);
        };

        document.addEventListener("keydown", handleAcceptShortcut);
        return () => document.removeEventListener("keydown", handleAcceptShortcut);
    }, [pendingConfirmId, acceptKeybind]);

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            sendPrompt();
        }
    };

    return (
        <FloatingWindow
            className="ai-assistant-window"
            icon={mdiRobotHappyOutline}
            title={t("servers.aiAssistant.title")}
            titleExtra={session.server?.name && <span className="target">{session.server.name}</span>}
            onClose={onClose}
            initialSize={{ width: 460, height: 620 }}
        >
            <div className="ai-assistant-messages" ref={messagesRef}>
                {messages.length === 0 && !connectionError && (
                    <div className="ai-assistant-empty">
                        <Icon path={mdiRobotHappyOutline} />
                        <p>{t("servers.aiAssistant.empty")}</p>
                    </div>
                )}

                {messages.map((message, i) => {
                    if (message.role === "user") return <div key={i} className="message user"><MessageContent text={message.text} /></div>;
                    if (message.role === "assistant") return <div key={i} className="message assistant"><MessageContent text={message.text} /></div>;
                    if (message.role === "system") return <div key={i} className="message system">{message.text}</div>;
                    return <ToolCard key={i} message={message} onConfirm={confirmTool} acceptHint={acceptHint} />;
                })}

                {running && <div className="ai-typing"><span /><span /><span /></div>}
                {connectionError && <div className="message system error">{connectionError}</div>}
            </div>

            <div className="ai-assistant-input">
                <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
                          onKeyDown={handleKeyDown} rows={1} disabled={!ready}
                          placeholder={ready ? t("servers.aiAssistant.placeholder") : t("servers.aiAssistant.connecting")} />
                {running ? (
                    <Button type="danger" icon={mdiStop} onClick={stop} title={t("servers.aiAssistant.stop")} />
                ) : (
                    <Button type="primary" icon={mdiSend} onClick={sendPrompt} disabled={!input.trim() || !ready}
                            title={t("servers.aiAssistant.send")} />
                )}
            </div>
        </FloatingWindow>
    );
};
