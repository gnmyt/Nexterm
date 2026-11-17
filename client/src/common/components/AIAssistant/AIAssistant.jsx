import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiRobotHappyOutline, mdiSend, mdiStop, mdiClose, mdiPlay, mdiPlus } from "@mdi/js";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { useAI } from "@/common/contexts/AIContext.jsx";
import { useActiveSessions } from "@/common/contexts/SessionContext.jsx";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import { useKeymaps, matchesKeybind } from "@/common/contexts/KeymapContext.jsx";
import Button from "@/common/components/Button";
import FloatingWindow from "@/common/components/FloatingWindow";
import { useContextMenu } from "@/common/components/ContextMenu";
import { getWebSocketUrl } from "@/common/utils/ConnectionUtil.js";
import { getIconPath } from "@/common/utils/iconUtils.js";
import MessageContent from "./components/MessageContent";
import UserMessage from "./components/UserMessage";
import ToolCard from "./components/ToolCard";
import QuestionCard from "./components/QuestionCard";
import ServerMenu from "./components/ServerMenu";
import ApprovalMenu from "./components/ApprovalMenu";
import { autoGrow, isPlainEnter, newId, protocolLabel, toggleMenuAbove } from "./utils.js";
import "./styles.sass";

const flattenServers = (entries, path = []) => (entries || []).flatMap((entry) =>
    entry.type === "folder" || entry.type === "organization"
        ? flattenServers(entry.entries, [...path, entry.name])
        : entry.type === "server" || entry.type?.startsWith("pve-")
            ? [{ id: entry.id, name: entry.name, icon: entry.icon, protocol: entry.protocol || entry.type, path: path.join(" / ") }]
            : []);

const AssistantWindow = () => {
    const { t } = useTranslation();
    const { sessionToken } = useContext(UserContext);
    const { servers } = useContext(ServerContext);
    const { activeSessions, activeSessionId } = useActiveSessions();
    const { closeAssistant, approvalMode, setApprovalMode } = useAI();
    const { getParsedKeybind, getKeybind, formatKey } = useKeymaps();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [running, setRunning] = useState(false);
    const [ready, setReady] = useState(false);
    const [needsContinue, setNeedsContinue] = useState(false);
    const [connectionError, setConnectionError] = useState(null);
    const serverMenu = useContextMenu();
    const [agentSessions, setAgentSessions] = useState([]);
    const wsRef = useRef(null);
    const messagesRef = useRef(null);
    const inputRef = useRef(null);

    const allServers = useMemo(() => flattenServers(servers), [servers]);
    const serverById = useMemo(() => new Map(allServers.map((server) => [server.id, server])), [allServers]);

    const activeSession = activeSessions.find((session) => session.id === activeSessionId);
    const activeEntryId = activeSession && !activeSession.automated && !activeSession.isJoined && activeSession.type !== "notes"
        ? activeSession.server?.id ?? null : null;

    const [allowedEntryIds, setAllowedEntryIds] = useState(() => (activeEntryId ? [activeEntryId] : []));
    const allowEntry = useCallback((entryId) => setAllowedEntryIds((prev) => (prev.includes(entryId) ? prev : [...prev, entryId])), []);
    const revokeEntry = useCallback((entryId) => setAllowedEntryIds((prev) => prev.filter((id) => id !== entryId)), []);

    const [lastActiveEntryId, setLastActiveEntryId] = useState(activeEntryId);
    if (activeEntryId !== lastActiveEntryId) {
        setLastActiveEntryId(activeEntryId);
        if (activeEntryId) allowEntry(activeEntryId);
    }

    const allowedServers = useMemo(() => allowedEntryIds.map((id) => serverById.get(id)).filter(Boolean),
        [allowedEntryIds, serverById]);
    const configRef = useRef({ allowedEntryIds: [], activeEntryId: null, approvalMode: "ask" });

    const sendConfig = useCallback(() => {
        const ws = wsRef.current;
        if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "config", ...configRef.current }));
    }, []);

    useEffect(() => {
        configRef.current = { allowedEntryIds: allowedServers.map((s) => s.id), activeEntryId, approvalMode };
        sendConfig();
    }, [allowedServers, activeEntryId, approvalMode, sendConfig]);

    const appendAssistant = (delta) => {
        setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant" && last.streaming) {
                return [...prev.slice(0, -1), { ...last, text: last.text + delta }];
            }
            return [...prev, { role: "assistant", text: delta, streaming: true }];
        });
    };

    const upsertTool = useCallback((callId, patch, base) => {
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
    }, []);

    const stopStreaming = () => {
        setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant" && last.streaming) {
                return [...prev.slice(0, -1), { ...last, streaming: false }];
            }
            return prev;
        });
    };

    const finalizeRunningTools = () => {
        setMessages((prev) => prev.map((m) => (
            m.role === "tool" && (m.status === "running" || m.status === "awaiting-confirm" || m.status === "awaiting-answer")
                ? { ...m, status: "aborted" } : m
        )));
    };

    useEffect(() => {
        if (!sessionToken) return;

        let closedByUs = false;
        let retryTimer = null;
        let attempts = 0;
        setConnectionError(null);

        const conversationId = newId();

        const connect = () => {
            const ws = new WebSocket(getWebSocketUrl("/api/ws/ai", { sessionToken, conversationId }));
            wsRef.current = ws;

            ws.onmessage = (event) => {
                const msg = JSON.parse(event.data);
                switch (msg.type) {
                    case "ready":
                        setReady(true); setConnectionError(null); attempts = 0;
                        if (msg.sessions) setAgentSessions(msg.sessions);
                        sendConfig();
                        break;
                    case "text-delta": appendAssistant(msg.delta); break;
                    case "tool-call":
                        stopStreaming();
                        upsertTool(msg.callId, {}, { tool: msg.tool, args: msg.args, status: "running" });
                        break;
                    case "confirm-request":
                        upsertTool(msg.callId, { status: "awaiting-confirm", tool: msg.tool, args: msg.args },
                            { tool: msg.tool, args: msg.args, status: "awaiting-confirm" });
                        break;
                    case "question": {
                        const { question, options, multiSelect, allowFreeText } = msg;
                        stopStreaming();
                        upsertTool(msg.callId, { status: "awaiting-answer", question: true, args: { question, options, multiSelect, allowFreeText } },
                            { tool: "ask_user", args: { question, options, multiSelect, allowFreeText }, status: "awaiting-answer", question: true });
                        break;
                    }
                    case "tool-result":
                        upsertTool(msg.callId, { status: msg.result?.denied ? "denied" : "done", result: msg.result });
                        break;
                    case "tool-error":
                        upsertTool(msg.callId, { status: "error", error: msg.error });
                        break;
                    case "step-limit": stopStreaming(); setNeedsContinue(true); break;
                    case "compacted":
                        setMessages((prev) => [...prev, { role: "system", text: t("servers.aiAssistant.compacted") }]);
                        break;
                    case "done":
                        stopStreaming(); setRunning(false);
                        if (msg.sessions) setAgentSessions(msg.sessions);
                        break;
                    case "aborted": stopStreaming(); finalizeRunningTools(); setRunning(false); setNeedsContinue(false); break;
                    case "error":
                        stopStreaming(); finalizeRunningTools(); setRunning(false); setNeedsContinue("error");
                        setMessages((prev) => [...prev, { role: "system", text: msg.message }]);
                        break;
                    default: break;
                }
            };

            ws.onclose = (event) => {
                if (closedByUs) return;
                setReady(false);
                setRunning(false);
                stopStreaming();
                finalizeRunningTools();

                if (event.code >= 4000) {
                    setConnectionError(event.reason || t("servers.aiAssistant.connectionError"));
                    return;
                }
                if (event.code === 1000 || event.code === 1005) return;

                attempts += 1;
                if (attempts <= 5) {
                    setConnectionError(t("servers.aiAssistant.reconnecting"));
                    retryTimer = setTimeout(connect, Math.min(1000 * 2 ** attempts, 10000));
                } else {
                    setConnectionError(t("servers.aiAssistant.connectionError"));
                }
            };
            ws.onerror = () => {
                if (!closedByUs) setReady(false);
            };
        };

        connect();

        return () => {
            closedByUs = true;
            clearTimeout(retryTimer);
            const ws = wsRef.current;
            if (ws) {
                ws.onmessage = null;
                ws.onclose = null;
                ws.onerror = null;
                if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "close" }));
                ws.close();
            }
        };
    }, [sessionToken]);

    const stickToBottom = useRef(true);
    const onScroll = () => {
        const el = messagesRef.current;
        if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    };

    useEffect(() => {
        if (stickToBottom.current) messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight });
    }, [messages]);

    useEffect(() => {
        if (ready) inputRef.current?.focus();
    }, [ready]);

    useEffect(() => { if (!input) autoGrow(inputRef.current); }, [input]);

    const sendPrompt = () => {
        const content = input.trim();
        if (!content || running || !ready) return;
        const id = newId();
        wsRef.current?.send(JSON.stringify({ type: "prompt", content, promptId: id }));
        setMessages((prev) => [...prev, { role: "user", id, text: content }]);
        setInput("");
        setNeedsContinue(false);
        setRunning(true);
    };

    const editPrompt = useCallback((promptId, content) => {
        const ws = wsRef.current;
        if (ws?.readyState !== WebSocket.OPEN) return;
        const id = newId();
        ws.send(JSON.stringify({ type: "edit", promptId, newPromptId: id, content }));
        setMessages((prev) => {
            const index = prev.findIndex((m) => m.role === "user" && m.id === promptId);
            return [...(index === -1 ? prev : prev.slice(0, index)), { role: "user", id, text: content }];
        });
        stickToBottom.current = true;
        setNeedsContinue(false);
        setRunning(true);
    }, []);

    const continueRun = () => {
        if (running || !ready) return;
        wsRef.current?.send(JSON.stringify({ type: "continue" }));
        setNeedsContinue(false);
        setRunning(true);
    };

    const stop = () => {
        wsRef.current?.send(JSON.stringify({ type: "abort" }));
        stopStreaming();
        finalizeRunningTools();
        setRunning(false);
        setNeedsContinue(false);
    };

    const answerQuestion = useCallback((callId, answer) => {
        wsRef.current?.send(JSON.stringify({ type: "answer", callId, answer }));
        upsertTool(callId, { status: "done", result: { answer } });
    }, [upsertTool]);

    const confirmTool = useCallback((callId, allow) => {
        wsRef.current?.send(JSON.stringify({ type: "confirm", callId, allow }));
        upsertTool(callId, { status: allow ? "running" : "denied" });
    }, [upsertTool]);

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
    }, [pendingConfirmId, acceptKeybind, confirmTool]);

    const handleKeyDown = (e) => {
        if (isPlainEnter(e)) {
            e.preventDefault();
            sendPrompt();
        }
    };

    const openCount = agentSessions.length;

    return (
        <FloatingWindow
            className="ai-assistant-window"
            icon={mdiRobotHappyOutline}
            title={t("servers.aiAssistant.title")}
            onClose={closeAssistant}
            initialSize={{ width: 480, height: 660 }}
        >
            <div className="ai-assistant-messages" ref={messagesRef} onScroll={onScroll}>
                {messages.length === 0 && !connectionError && (
                    <div className="ai-assistant-empty">
                        <Icon path={mdiRobotHappyOutline} />
                        <p>{t("servers.aiAssistant.empty")}</p>
                    </div>
                )}

                {messages.map((message, i) => {
                    if (message.role === "tool" && message.question) {
                        return <QuestionCard key={message.callId} message={message} onAnswer={answerQuestion} />;
                    }
                    if (message.role === "tool") {
                        return <ToolCard key={message.callId} message={message} onConfirm={confirmTool}
                                         acceptHint={acceptHint} />;
                    }
                    const key = `msg-${i}`;
                    if (message.role === "user") {
                        return <UserMessage key={message.id || key} message={message} canEdit={ready && !running} onEdit={editPrompt} />;
                    }
                    if (message.role === "assistant") return <div key={key} className="message assistant"><MessageContent text={message.text} /></div>;
                    return <div key={key} className="message system">{message.text}</div>;
                })}

                {needsContinue && !running && (
                    <div className="ai-continue">
                        <span>{t(needsContinue === "error" ? "servers.aiAssistant.retryPrompt" : "servers.aiAssistant.continuePrompt")}</span>
                        <Button icon={mdiPlay} text={t(needsContinue === "error" ? "servers.aiAssistant.retry" : "servers.aiAssistant.continue")}
                                onClick={continueRun} disabled={!ready} />
                    </div>
                )}

                {running && <div className="ai-typing"><span /><span /><span /></div>}
                {connectionError && <div className="message system error">{connectionError}</div>}
            </div>

            <div className="ai-assistant-input">
                <ServerMenu menu={serverMenu} allServers={allServers} allowedIds={allowedEntryIds}
                            onToggle={(id) => (allowedEntryIds.includes(id) ? revokeEntry(id) : allowEntry(id))} />
                <div className={`ai-composer${ready ? "" : " disabled"}`} onClick={() => inputRef.current?.focus()}>
                    <div className="ai-composer-context">
                        {allowedServers.map((server) => (
                            <span key={server.id} className={`ai-context-chip${server.id === activeEntryId ? " current" : ""}`}
                                  title={[protocolLabel(server.protocol), server.path, server.id === activeEntryId ? t("servers.aiAssistant.current") : null].filter(Boolean).join(" · ")}>
                                <Icon path={getIconPath(server.icon)} />
                                <span className="name">{server.name}</span>
                                <button type="button" className="remove" aria-label={t("servers.aiAssistant.removeServer")}
                                        title={t("servers.aiAssistant.removeServer")}
                                        onClick={(e) => { e.stopPropagation(); revokeEntry(server.id); }}>
                                    <Icon path={mdiClose} />
                                </button>
                            </span>
                        ))}
                        <button type="button"
                                className={`ai-context-add${allowedServers.length === 0 ? " labeled" : ""}${serverMenu.isOpen ? " active" : ""}`}
                                title={t("servers.aiAssistant.addServer")} aria-label={t("servers.aiAssistant.addServer")}
                                onClick={(e) => toggleMenuAbove(serverMenu, e)}>
                            <Icon path={mdiPlus} />
                            {allowedServers.length === 0 && <span>{t("servers.aiAssistant.addServer")}</span>}
                        </button>
                    </div>
                    <textarea ref={inputRef} value={input} onChange={(e) => { setInput(e.target.value); autoGrow(e.target); }}
                              onKeyDown={handleKeyDown} rows={1} disabled={!ready}
                              placeholder={ready ? t("servers.aiAssistant.placeholder") : t("servers.aiAssistant.connecting")} />
                    <div className="ai-composer-footer">
                        <ApprovalMenu mode={approvalMode} onSelect={setApprovalMode} />
                        <span className="ai-composer-status">
                            {openCount > 0 ? t("servers.aiAssistant.openSessions", { count: openCount }) : ""}
                        </span>
                        {running ? (
                            <button type="button" className="ai-composer-send stop" onClick={stop} title={t("servers.aiAssistant.stop")}>
                                <Icon path={mdiStop} />
                            </button>
                        ) : (
                            <button type="button" className="ai-composer-send" onClick={sendPrompt} disabled={!input.trim() || !ready}
                                    title={t("servers.aiAssistant.send")}>
                                <Icon path={mdiSend} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </FloatingWindow>
    );
};

export const AIAssistant = () => {
    const { assistantOpen, toggleAssistant, isAIAvailable } = useAI();
    const { getParsedKeybind } = useKeymaps();
    const available = isAIAvailable();

    useEffect(() => {
        if (!available) return;
        const handleKeyDown = (event) => {
            const keybind = getParsedKeybind?.("ai-menu");
            if (!keybind || !matchesKeybind(event, keybind)) return;
            event.preventDefault();
            toggleAssistant();
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [available, getParsedKeybind, toggleAssistant]);

    if (!available || !assistantOpen) return null;
    return <AssistantWindow />;
};
