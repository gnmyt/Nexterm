import "./styles.sass";
import ServerTabs from "./components/ServerTabs";
import SessionDropZone from "./components/SessionDropZone";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useDragLayer } from "react-dnd";
import { collectLeaves, computeGeometry, findNodeById } from "./utils/layoutTree.js";
import GuacamoleRenderer from "@/pages/Servers/components/ViewContainer/renderer/GuacamoleRenderer.jsx";
import BrowserRenderer from "@/pages/Servers/components/ViewContainer/renderer/BrowserRenderer.jsx";
import XtermRenderer from "@/pages/Servers/components/ViewContainer/renderer/XtermRenderer.jsx";
import FileRenderer from "@/pages/Servers/components/ViewContainer/renderer/FileRenderer";
import ScriptRenderer from "@/pages/Servers/components/ViewContainer/renderer/ScriptRenderer";
import NotesRenderer from "@/pages/Servers/components/ViewContainer/renderer/NotesRenderer";
import Icon from "@mdi/react";
import { mdiFullscreenExit } from "@mdi/js";
import { useTranslation } from "react-i18next";
import { getTitleBarHeight } from "@/common/utils/TauriUtil.js";
import { useTauriWindow } from "@/common/hooks/useTauriWindow.js";
import { useBodyClass } from "@/common/hooks/useBodyClass.js";

const BTN_SIZE = 44;
const BTN_STORAGE_KEY = "fullscreen-btn-position";
const SASH_SIZE = 4;
const MIN_PANE_SIZE = 96;
const FULL_SIZE_STYLE = { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" };

const getMinY = () => getTitleBarHeight() + 16;
const clampPosition = (x, y) => ({
    x: Math.max(0, Math.min(window.innerWidth - BTN_SIZE, x)),
    y: Math.max(getMinY(), Math.min(window.innerHeight - BTN_SIZE, y))
});

const loadBtnPosition = () => {
    try {
        const saved = JSON.parse(localStorage.getItem(BTN_STORAGE_KEY));
        if (saved) return clampPosition(saved.x, saved.y);
    } catch {}
    return { x: window.innerWidth - 60, y: getMinY() };
};

export const ViewContainer = ({
                                  activeSessions,
                                  activeSessionId,
                                  setActiveSessionId,
                                  disconnectFromServer,
                                  closeSession,
                                  hibernateSession,
                                  duplicateSession,
                                  openNotes,
                                  markSessionErrored,
                                  getSessionError,
                                  setOpenFileEditors,
                                  openTerminalFromFileManager,
                                  sessionLayout,
                                  connectFromDrop,
                              }) => {
    const { tree } = sessionLayout;
    const layoutMode = tree ? "split" : "single";
    const sessionRefs = useRef({});
    const terminalRefs = useRef({});
    const guacamoleRefs = useRef({});
    const scriptStateRefs = useRef({});
    const tabOrderRef = useRef([]);
    const [broadcastMode, setBroadcastMode] = useState(false);
    const [sessionProgress, setSessionProgress] = useState({});
    const [sessionPageInfo, setSessionPageInfo] = useState({});
    const [fullscreenMode, setFullscreenMode] = useState(false);
    const [titleBarTabsSlot, setTitleBarTabsSlot] = useState(null);
    const appWindow = useTauriWindow();
    const { t } = useTranslation();

    useEffect(() => {
        setTitleBarTabsSlot(document.getElementById("titlebar-tabs-slot"));
    }, []);

    useBodyClass("session-fullscreen", fullscreenMode);

    useEffect(() => {
        if (!appWindow) return;

        let cancelled = false, unlistenResized;
        (async () => {
            const syncFullscreen = async () => {
                const active = await appWindow.isFullscreen();
                if (!cancelled) setFullscreenMode(active);
            };
            await syncFullscreen();
            const unlisten = await appWindow.onResized(syncFullscreen);
            cancelled ? unlisten() : unlistenResized = unlisten;
        })();

        return () => {
            cancelled = true;
            unlistenResized?.();
        };
    }, [appWindow]);

    useEffect(() => {
        if (!appWindow) return;

        let cancelled = false;
        appWindow.isFullscreen().then(active => {
            if (!cancelled && active !== fullscreenMode) appWindow.setFullscreen(fullscreenMode);
        });

        return () => cancelled = true;
    }, [appWindow, fullscreenMode]);

    const [btnPosition, setBtnPosition] = useState(loadBtnPosition);
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef({ startX: 0, startY: 0, btnX: 0, btnY: 0 });

    const [resizingOrientation, setResizingOrientation] = useState(null);
    const [layoutSize, setLayoutSize] = useState({ width: 0, height: 0 });
    const layoutRef = useRef(null);
    const previousSessionIdsRef = useRef(new Set());

    const { dragItemType } = useDragLayer((monitor) => ({
        dragItemType: monitor.isDragging() ? monitor.getItemType() : null,
    }));
    const showDropZones = dragItemType === "TAB" || dragItemType === "server";

    const activeSession = activeSessions.find(session => session.id === activeSessionId);
    const hasGuacamole = activeSession?.server?.renderer === "guac";

    const registerTerminalRef = useCallback((sessionId, refs) => {
        refs ? terminalRefs.current[sessionId] = refs : delete terminalRefs.current[sessionId];
    }, []);

    const registerGuacamoleRef = useCallback((sessionId, refs) => {
        refs ? guacamoleRefs.current[sessionId] = refs : delete guacamoleRefs.current[sessionId];
    }, []);

    const updateSessionProgress = useCallback((sessionId, progress) => {
        setSessionProgress(prev => ({
            ...prev,
            [sessionId]: progress,
        }));
    }, []);

    const updatePageInfo = useCallback((sessionId, info) => {
        setSessionPageInfo(prev => {
            const current = prev[sessionId];
            if (current?.title === info.title && current?.icon === info.icon) return prev;
            return { ...prev, [sessionId]: { ...current, ...info } };
        });
    }, []);

    const updateScriptState = useCallback((sessionId, state) => {
        scriptStateRefs.current[sessionId] = {
            ...scriptStateRefs.current[sessionId],
            ...state,
        };
    }, []);

    const getScriptState = useCallback((sessionId) => {
        return scriptStateRefs.current[sessionId] || null;
    }, []);

    const toggleBroadcastMode = useCallback(() => {
        setBroadcastMode(prev => !prev);
    }, []);

    const toggleFullscreenMode = useCallback(() => {
        setFullscreenMode(prev => !prev);
    }, []);

    const onBtnMouseDown = useCallback((e) => {
        e.preventDefault();
        dragRef.current = { startX: e.clientX, startY: e.clientY, btnX: btnPosition.x, btnY: btnPosition.y };
        setIsDragging(true);
    }, [btnPosition]);

    useEffect(() => {
        if (!isDragging) return;
        const onMove = (e) => {
            const { startX, startY, btnX, btnY } = dragRef.current;
            setBtnPosition(clampPosition(btnX + e.clientX - startX, btnY + e.clientY - startY));
        };
        const onUp = () => {
            setIsDragging(false);
            try { localStorage.setItem(BTN_STORAGE_KEY, JSON.stringify(btnPosition)); } catch {}
        };
        document.addEventListener("mousemove", onMove, true);
        document.addEventListener("mouseup", onUp, true);
        return () => {
            document.removeEventListener("mousemove", onMove, true);
            document.removeEventListener("mouseup", onUp, true);
        };
    }, [isDragging, btnPosition]);

    useEffect(() => {
        const onResize = () => setBtnPosition(prev => clampPosition(prev.x, prev.y));
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    const onBtnClick = useCallback((e) => {
        const { startX, startY } = dragRef.current;
        if (Math.abs(e.clientX - startX) < 5 && Math.abs(e.clientY - startY) < 5) toggleFullscreenMode();
    }, [toggleFullscreenMode]);

    const handleKeyboardShortcut = useCallback((keys) => {
        const activeGuacamole = guacamoleRefs.current[activeSessionId];
        if (activeGuacamole && activeGuacamole.client) {
            keys.forEach(key => activeGuacamole.client.sendKeyEvent(1, key));
            setTimeout(() => {
                [...keys].reverse().forEach(key => activeGuacamole.client.sendKeyEvent(0, key));
            }, 50);
        }
    }, [activeSessionId]);

    const handleSnippetSelected = useCallback((command) => {
        const commandWithNewline = command.endsWith("\n") ? command : command + "\n";

        if (broadcastMode && layoutMode !== "single") {
            Object.entries(terminalRefs.current).forEach(([, { ws }]) => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(commandWithNewline);
                }
            });

            Object.entries(guacamoleRefs.current).forEach(([, { client }]) => {
                if (client) {
                    for (let i = 0; i < command.length; i++) {
                        const char = command.charCodeAt(i);
                        setTimeout(() => {
                            client.sendKeyEvent(1, char);
                            setTimeout(() => client.sendKeyEvent(0, char), 10);
                        }, i * 20);
                    }
                    if (commandWithNewline.endsWith("\n")) {
                        setTimeout(() => {
                            client.sendKeyEvent(1, 0xff0d);
                            setTimeout(() => client.sendKeyEvent(0, 0xff0d), 10);
                        }, command.length * 20);
                    }
                }
            });
        } else {
            const activeSession = activeSessions.find(s => s.id === activeSessionId);

            if (activeSession?.server.renderer === "terminal") {
                const activeTerminal = terminalRefs.current[activeSessionId];
                if (activeTerminal && activeTerminal.ws && activeTerminal.ws.readyState === WebSocket.OPEN) {
                    activeTerminal.ws.send(commandWithNewline);
                    if (activeTerminal.term) {
                        activeTerminal.term.focus();
                    }
                }
            } else if (activeSession?.server.renderer === "guac") {
                const activeGuacamole = guacamoleRefs.current[activeSessionId];
                if (activeGuacamole && activeGuacamole.client) {
                    for (let i = 0; i < command.length; i++) {
                        const char = command.charCodeAt(i);
                        setTimeout(() => {
                            activeGuacamole.client.sendKeyEvent(1, char);
                            setTimeout(() => activeGuacamole.client.sendKeyEvent(0, char), 10);
                        }, i * 20);
                    }
                    if (commandWithNewline.endsWith("\n")) {
                        setTimeout(() => {
                            activeGuacamole.client.sendKeyEvent(1, 0xff0d);
                            setTimeout(() => activeGuacamole.client.sendKeyEvent(0, 0xff0d), 10);
                        }, command.length * 20);
                    }
                }
            }
        }
    }, [layoutMode, activeSessionId, broadcastMode, activeSessions]);

    useEffect(() => {
        if (layoutMode === "single") {
            setBroadcastMode(false);
        }
    }, [layoutMode]);

    const focusSessionElement = useCallback((sessionId) => {
        setTimeout(() => {
            const sessionElement = sessionRefs.current[sessionId];
            if (sessionElement) {
                const terminalElement = sessionElement.querySelector("canvas, textarea, input, [tabindex]");
                if (terminalElement) {
                    terminalElement.focus();
                } else {
                    sessionElement.setAttribute("tabindex", "-1");
                    sessionElement.focus();
                }
            }
        }, 100);
    }, []);

    const focusSession = useCallback((sessionId) => {
        sessionLayout.showSession(sessionId);
        setActiveSessionId(sessionId);
        focusSessionElement(sessionId);
    }, [sessionLayout, setActiveSessionId, focusSessionElement]);

    useEffect(() => {
        const element = layoutRef.current;
        if (!element) return;
        const observer = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            setLayoutSize(current => (current.width === width && current.height === height) ? current : { width, height });
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    const geometry = useMemo(() => {
        if (!tree || layoutSize.width === 0 || layoutSize.height === 0) return null;
        return computeGeometry(tree, { x: 0, y: 0, width: layoutSize.width, height: layoutSize.height }, SASH_SIZE);
    }, [tree, layoutSize]);

    const startSashDrag = useCallback((event, sash) => {
        event.preventDefault();
        event.stopPropagation();
        const branch = findNodeById(tree, sash.branchId);
        const branchRect = geometry?.branches.get(sash.branchId);
        if (!branch || !branchRect) return;

        const horizontal = branch.orientation === "horizontal";
        const available = (horizontal ? branchRect.width : branchRect.height) - SASH_SIZE * (branch.children.length - 1);
        if (available <= 0) return;

        const startPosition = horizontal ? event.clientX : event.clientY;
        const initialSizes = [...branch.sizes];
        const pairTotal = initialSizes[sash.index] + initialSizes[sash.index + 1];
        const minimumFraction = Math.min(MIN_PANE_SIZE / available, pairTotal / 2);
        setResizingOrientation(branch.orientation);

        const handleMove = (moveEvent) => {
            const delta = ((horizontal ? moveEvent.clientX : moveEvent.clientY) - startPosition) / available;
            const first = Math.max(minimumFraction, Math.min(pairTotal - minimumFraction, initialSizes[sash.index] + delta));
            const sizes = [...initialSizes];
            sizes[sash.index] = first;
            sizes[sash.index + 1] = pairTotal - first;
            sessionLayout.resizeBranch(sash.branchId, sizes);
        };

        const handleUp = () => {
            setResizingOrientation(null);
            document.removeEventListener("pointermove", handleMove, true);
            document.removeEventListener("pointerup", handleUp, true);
            document.removeEventListener("pointercancel", handleUp, true);
        };

        document.addEventListener("pointermove", handleMove, true);
        document.addEventListener("pointerup", handleUp, true);
        document.addEventListener("pointercancel", handleUp, true);
    }, [tree, geometry, sessionLayout]);

    const toggleSplitMode = () => {
        if (tree) {
            sessionLayout.clearLayout();
            return;
        }
        const orderedIds = tabOrderRef.current.filter(id => activeSessions.some(session => session.id === id));
        const remainingIds = activeSessions.map(session => session.id).filter(id => !orderedIds.includes(id));
        sessionLayout.splitAll([...orderedIds, ...remainingIds]);
    };

    const splitActiveWith = useCallback((sessionId, edge) => {
        if (!activeSessionId || activeSessionId === sessionId) return;
        sessionLayout.splitWithSession(activeSessionId, edge, sessionId);
        setActiveSessionId(sessionId);
        focusSessionElement(sessionId);
    }, [activeSessionId, sessionLayout, setActiveSessionId, focusSessionElement]);

    const handlePaneDrop = useCallback((pane, itemType, item, edge) => {
        if (itemType === "server") {
            connectFromDrop(item.id, edge === "center" ? null : { targetSessionId: pane.sessionId, edge });
            return;
        }

        if (edge === "center") {
            if (tree) sessionLayout.showSessionInPane(pane.id, item.sessionId);
            focusSession(item.sessionId);
            return;
        }

        if (pane.sessionId === item.sessionId) return;
        sessionLayout.splitWithSession(pane.sessionId, edge, item.sessionId);
        setActiveSessionId(item.sessionId);
        focusSessionElement(item.sessionId);
    }, [tree, sessionLayout, connectFromDrop, focusSession, setActiveSessionId, focusSessionElement]);

    useEffect(() => {
        const visibleIds = new Set(activeSessions.map(session => session.id));
        const previousIds = previousSessionIdsRef.current;
        const addedIds = new Set([...visibleIds].filter(id => !previousIds.has(id)));
        const removedAny = [...previousIds].some(id => !visibleIds.has(id));
        previousSessionIdsRef.current = visibleIds;

        const nextActiveId = sessionLayout.reconcile({ visibleIds, activeSessionId, addedIds, removedAny });
        if (nextActiveId !== activeSessionId) setActiveSessionId(nextActiveId);
    }, [activeSessions, activeSessionId, sessionLayout, setActiveSessionId]);

    useEffect(() => {
        if (activeSessionId && activeSessions.some(session => session.id === activeSessionId)) {
            focusSessionElement(activeSessionId);
        }
    }, [activeSessions.length, activeSessionId, focusSessionElement]);

    const renderRenderer = (session) => {
        if (session.type === "notes") {
            return <NotesRenderer session={session} />;
        }

        if (session.scriptId) {
            return <ScriptRenderer
                session={session}
                disconnectFromServer={disconnectFromServer}
                markSessionErrored={markSessionErrored}
                getSessionError={getSessionError}
                updateProgress={updateSessionProgress}
                savedState={getScriptState(session.id)}
                saveState={(state) => updateScriptState(session.id, state)} />;
        }

        const renderer = session.type || session.server.renderer;

        switch (renderer) {
            case "guac":
                return <GuacamoleRenderer session={session} disconnectFromServer={disconnectFromServer}
                                          markSessionErrored={markSessionErrored}
                                          getSessionError={getSessionError}
                                          registerGuacamoleRef={registerGuacamoleRef}
                                          isShared={!!session.isJoined}
                                          fullscreenEnabled={fullscreenMode}
                                          onFullscreenToggle={toggleFullscreenMode} />;
            case "web":
                return <BrowserRenderer session={session} disconnectFromServer={disconnectFromServer}
                                        onPageInfo={(info) => updatePageInfo(session.id, info)}
                                        markSessionErrored={markSessionErrored}
                                        getSessionError={getSessionError}
                                        registerGuacamoleRef={registerGuacamoleRef}
                                        isShared={!!session.isJoined}
                                        fullscreenEnabled={fullscreenMode}
                                        onFullscreenToggle={toggleFullscreenMode} />;
            case "terminal":
                return <XtermRenderer session={session} disconnectFromServer={disconnectFromServer}
                                      isShared={!!session.isJoined}
                                      markSessionErrored={markSessionErrored}
                                      getSessionError={getSessionError}
                                      registerTerminalRef={registerTerminalRef} broadcastMode={broadcastMode}
                                      terminalRefs={terminalRefs} updateProgress={updateSessionProgress}
                                      layoutMode={layoutMode} onBroadcastToggle={toggleBroadcastMode}
                                      onFullscreenToggle={toggleFullscreenMode} />;
            case "sftp":
                return <FileRenderer session={session} disconnectFromServer={disconnectFromServer}
                                     setOpenFileEditors={setOpenFileEditors} isActive={session.id === activeSessionId}
                                     onOpenTerminal={(path) => openTerminalFromFileManager?.(session.id, path)} />;
            default:
                return <p>Unknown renderer: {renderer}</p>;
        }
    };

    const leafBySession = useMemo(() => {
        const map = new Map();
        collectLeaves(tree).forEach(leaf => map.set(leaf.sessionId, leaf));
        return map;
    }, [tree]);

    const getSessionStyle = (session) => {
        if (!tree) {
            const visible = session.id === activeSessionId;
            return { ...FULL_SIZE_STYLE, zIndex: visible ? 1 : -1, opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none" };
        }

        const rect = geometry?.leaves.get(leafBySession.get(session.id)?.id);
        if (!rect) return { ...FULL_SIZE_STYLE, zIndex: -1, opacity: 0, pointerEvents: "none" };
        return { position: "absolute", left: rect.x, top: rect.y, width: rect.width, height: rect.height, zIndex: 1 };
    };

    const renderAllSessions = () => activeSessions.map(session => {
        if (!session?.server) return null;
        const isVisible = tree ? leafBySession.has(session.id) : session.id === activeSessionId;
        const isActive = session.id === activeSessionId;
        return (
            <div key={session.id} ref={el => sessionRefs.current[session.id] = el}
                 className={`session-renderer ${isVisible ? "visible" : "hidden"}${isActive ? " active" : ""}`}
                 onClick={() => !isActive && focusSession(session.id)}
                 style={getSessionStyle(session)}>
                {renderRenderer(session)}
            </div>
        );
    });

    const renderSashes = () => geometry?.sashes.map(sash => (
        <div key={sash.id}
             className={`layout-sash ${sash.orientation === "horizontal" ? "columns" : "rows"}`}
             style={{ left: sash.rect.x, top: sash.rect.y, width: sash.rect.width, height: sash.rect.height }}
             onPointerDown={(event) => startSashDrag(event, sash)} />
    ));

    const renderDropZones = () => {
        if (!showDropZones) return null;

        if (!tree) {
            if (!activeSessionId) return null;
            const fullRect = { x: 0, y: 0, width: layoutSize.width, height: layoutSize.height };
            const pane = { id: null, sessionId: activeSessionId };
            return <SessionDropZone rect={fullRect} sessionId={activeSessionId}
                                    onDrop={(itemType, item, edge) => handlePaneDrop(pane, itemType, item, edge)} />;
        }

        return collectLeaves(tree).map(leaf => {
            const rect = geometry?.leaves.get(leaf.id);
            if (!rect) return null;
            return <SessionDropZone key={leaf.id} rect={rect} sessionId={leaf.sessionId}
                                    onDrop={(itemType, item, edge) => handlePaneDrop(leaf, itemType, item, edge)} />;
        });
    };

    const serverTabs = fullscreenMode && !titleBarTabsSlot ? null : (
        <ServerTabs activeSessions={activeSessions} setActiveSessionId={focusSession}
                    activeSessionId={activeSessionId}
                    closeSession={closeSession}
                    layoutMode={layoutMode} onToggleSplit={toggleSplitMode}
                    onSplitSession={splitActiveWith}
                    orderRef={tabOrderRef} onBroadcastToggle={toggleBroadcastMode}
                    onSnippetSelected={handleSnippetSelected} broadcastEnabled={broadcastMode}
                    onKeyboardShortcut={handleKeyboardShortcut} hasGuacamole={hasGuacamole}
                    sessionProgress={sessionProgress} sessionPageInfo={sessionPageInfo}
                    fullscreenEnabled={fullscreenMode}
                    onFullscreenToggle={toggleFullscreenMode}
                    openNotes={openNotes}
                    hibernateSession={hibernateSession} duplicateSession={duplicateSession} />
    );

    return (
        <div className={`view-container ${fullscreenMode ? "fullscreen" : ""}`}>
            {fullscreenMode && !hasGuacamole && !titleBarTabsSlot && (
                <div
                    className={`exit-fullscreen-btn-container ${isDragging ? "dragging" : ""}`}
                    style={{ left: btnPosition.x, top: btnPosition.y }}
                    onMouseDown={onBtnMouseDown}
                    onClick={onBtnClick}
                    title={t("servers.terminalActions.exitFullScreen")}
                >
                    <button className="exit-fullscreen-btn">
                        <Icon path={mdiFullscreenExit} />
                    </button>
                </div>
            )}
            {titleBarTabsSlot ? createPortal(serverTabs, titleBarTabsSlot) : serverTabs}

            <div ref={layoutRef}
                 className={`view-layouter ${layoutMode}${resizingOrientation ? ` resizing resizing-${resizingOrientation}` : ""}`}>
                {renderAllSessions()}
                {renderSashes()}
                {renderDropZones()}
            </div>
        </div>
    );
};