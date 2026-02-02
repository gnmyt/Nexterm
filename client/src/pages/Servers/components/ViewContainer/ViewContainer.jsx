import "./styles.sass";
import ServerTabs from "./components/ServerTabs";
import { useState, useRef, useCallback, useEffect } from "react";
import GuacamoleRenderer from "@/pages/Servers/components/ViewContainer/renderer/GuacamoleRenderer.jsx";
import XtermRenderer from "@/pages/Servers/components/ViewContainer/renderer/XtermRenderer.jsx";
import FileRenderer from "@/pages/Servers/components/ViewContainer/renderer/FileRenderer";
import ScriptRenderer from "@/pages/Servers/components/ViewContainer/renderer/ScriptRenderer";
import Icon from "@mdi/react";
import { mdiFullscreenExit } from "@mdi/js";
import { useTranslation } from "react-i18next";
import { getTitleBarHeight } from "@/common/utils/TauriUtil.js";

const BTN_SIZE = 44;
const BTN_STORAGE_KEY = "fullscreen-btn-position";

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
                                  setOpenFileEditors,
                                  openTerminalFromFileManager,
                              }) => {

    const [layoutMode, setLayoutMode] = useState("single");
    const [gridSessions, setGridSessions] = useState([]);
    const sessionRefs = useRef({});
    const terminalRefs = useRef({});
    const guacamoleRefs = useRef({});
    const scriptStateRefs = useRef({});
    const tabOrderRef = useRef([]);
    const [broadcastMode, setBroadcastMode] = useState(false);
    const [sessionProgress, setSessionProgress] = useState({});
    const [fullscreenMode, setFullscreenMode] = useState(false);
    const { t } = useTranslation();

    const [btnPosition, setBtnPosition] = useState(loadBtnPosition);
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef({ startX: 0, startY: 0, btnX: 0, btnY: 0 });

    const [columnSizes, setColumnSizes] = useState([]);
    const [rowSizes, setRowSizes] = useState([]);
    const [cellSizes, setCellSizes] = useState([]);
    const [isResizing, setIsResizing] = useState(false);
    const [resizingDirection, setResizingDirection] = useState(null);
    const resizeRef = useRef(null);
    const layoutRef = useRef(null);

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
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
        return () => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
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

    const onTabOrderChange = useCallback((newOrder) => {
        tabOrderRef.current = newOrder;
        if (layoutMode !== "single") {
            const filteredOrder = newOrder.filter(id => activeSessions.some(session => session.id === id));
            if (filteredOrder.length > 0) setGridSessions(filteredOrder);
        }
    }, [layoutMode, activeSessions]);

    const focusSession = useCallback((sessionId) => {
        setActiveSessionId(sessionId);

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
    }, [setActiveSessionId]);

    const initializeGridSizes = useCallback(({ rows, cols }) => {
        setColumnSizes(Array(cols).fill(1));
        setRowSizes(Array(rows).fill(1));
        setCellSizes(Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ width: 1, height: 1 }))));
    }, []);

    const handleResizerMouseDown = useCallback((e, type, index, rowIndex = null) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
        setResizingDirection(type);

        const layoutElement = layoutRef.current;
        if (!layoutElement) return;

        const layoutRect = layoutElement.getBoundingClientRect();
        const totalSize = type === "vertical" ? layoutRect.width : layoutRect.height;
        const layoutStart = type === "vertical" ? layoutRect.left : layoutRect.top;

        const isSegmentResize = rowIndex !== null && type === "vertical";
        const initialCellSizes = cellSizes.map(row => row.map(cell => ({ ...cell })));
        const initialRowSizes = [...rowSizes];
        const totalRowSize = initialRowSizes.reduce((sum, size) => sum + size, 0) || 1;

        const handleMouseMove = (moveEvent) => {
            const currentPos = type === "vertical" ? moveEvent.clientX : moveEvent.clientY;
            const relativePos = Math.max(0, Math.min(totalSize, currentPos - layoutStart));
            const mouseRatio = relativePos / totalSize;

            if (type === "vertical" && isSegmentResize && initialCellSizes[rowIndex]) {
                setCellSizes(prev => {
                    const newSizes = prev.map(row => row.map(cell => ({ ...cell })));
                    if (newSizes[rowIndex] && index < newSizes[rowIndex].length - 1) {
                        const rowCells = initialCellSizes[rowIndex];
                        const totalRowWidth = rowCells.reduce((sum, cell) => sum + cell.width, 0);
                        const widthsBefore = rowCells.slice(0, index).reduce((sum, cell) => sum + cell.width, 0);
                        const twoCellWidth = rowCells[index].width + rowCells[index + 1].width;

                        const targetWidth = (mouseRatio * totalRowWidth) - widthsBefore;
                        const clampedWidth = Math.max(0.15, Math.min(twoCellWidth - 0.15, targetWidth));

                        newSizes[rowIndex][index].width = clampedWidth;
                        newSizes[rowIndex][index + 1].width = twoCellWidth - clampedWidth;
                    }
                    return newSizes;
                });
            } else if (type === "horizontal") {
                setRowSizes(prev => {
                    const newSizes = [...prev];
                    if (index < newSizes.length - 1) {
                        const heightsBefore = initialRowSizes.slice(0, index).reduce((sum, size) => sum + size, 0);
                        const twoRowTotal = initialRowSizes[index] + initialRowSizes[index + 1];
                        const targetFirstRow = (mouseRatio * totalRowSize) - heightsBefore;
                        const clampedFirstRow = Math.max(0.15, Math.min(twoRowTotal - 0.15, targetFirstRow));
                        newSizes[index] = clampedFirstRow;
                        newSizes[index + 1] = twoRowTotal - clampedFirstRow;
                    }
                    return newSizes;
                });
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            setResizingDirection(null);
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);

        resizeRef.current = { type, index, handleMouseMove, handleMouseUp };
    }, [cellSizes, rowSizes]);

    const getDynamicLayout = (n) => {
        const layouts = { 1: [1,1], 2: [1,2], 3: [2,2], 4: [2,2], 5: [3,2], 6: [2,3] };
        const [rows, cols] = layouts[n] || [Math.ceil(n / Math.ceil(Math.sqrt(n))), Math.ceil(Math.sqrt(n))];
        return { mode: n <= 1 ? "single" : `grid-${rows}x${cols}`, rows, cols };
    };

    const toggleSplitMode = () => {
        if (layoutMode === "single") {
            const layout = getDynamicLayout(activeSessions.length);
            setLayoutMode(layout.mode);
            setGridSessions(tabOrderRef.current?.length ? tabOrderRef.current : activeSessions.map(s => s.id));
            initializeGridSizes(layout);
        } else {
            setLayoutMode("single");
            setGridSessions([]);
            setColumnSizes([]);
            setRowSizes([]);
            setCellSizes([]);
        }
    };

    const prevSessionCountRef = useRef(activeSessions.length);

    useEffect(() => {
        if (layoutMode === "single") return;
        const layout = getDynamicLayout(activeSessions.length);
        if (layout.mode !== layoutMode) setLayoutMode(layout.mode);
        setGridSessions(tabOrderRef.current?.length ? tabOrderRef.current : activeSessions.map(s => s.id));
        if (prevSessionCountRef.current !== activeSessions.length) {
            initializeGridSizes(layout);
            prevSessionCountRef.current = activeSessions.length;
        }
    }, [activeSessions, layoutMode, initializeGridSizes]);

    useEffect(() => {
        if (activeSessionId && activeSessions.some(session => session.id === activeSessionId)) {
            focusSession(activeSessionId);
        }
    }, [activeSessions.length, activeSessionId, focusSession]);

    const renderRenderer = (session) => {
        if (session.scriptId) {
            return <ScriptRenderer
                session={session}
                disconnectFromServer={disconnectFromServer}
                updateProgress={updateSessionProgress}
                savedState={getScriptState(session.id)}
                saveState={(state) => updateScriptState(session.id, state)} />;
        }

        const renderer = session.type || session.server.renderer;

        switch (renderer) {
            case "guac":
                return <GuacamoleRenderer session={session} disconnectFromServer={disconnectFromServer}
                                          registerGuacamoleRef={registerGuacamoleRef}
                                          onFullscreenToggle={toggleFullscreenMode} />;
            case "terminal":
                return <XtermRenderer session={session} disconnectFromServer={disconnectFromServer}
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

    const renderFlexLayout = () => {
        const { rows, cols } = getDynamicLayout(gridSessions.length);
        const totalRowHeight = rowSizes.reduce((sum, s) => sum + s, 0) || rows;
        const resizers = [];

        let cumHeight = 0;
        for (let r = 0; r < rows - 1; r++) {
            cumHeight += (rowSizes[r] || 1) / totalRowHeight;
            resizers.push(
                <div key={`h-${r}`} className="grid-resizer horizontal"
                     style={{ position: 'absolute', top: `calc(${cumHeight * 100}% - 1.5px)`, left: 0, height: 3, width: "100%", cursor: "row-resize", zIndex: 10 }}
                     onMouseDown={(e) => handleResizerMouseDown(e, "horizontal", r, null)} />
            );
        }

        for (let r = 0; r < rows; r++) {
            const sessionsInRow = Math.min(cols, gridSessions.length - r * cols);
            const rowCellWidths = (cellSizes[r] || columnSizes).slice(0, sessionsInRow).map(c => c?.width ?? 1);
            const totalRowWidth = rowCellWidths.reduce((sum, w) => sum + w, 0) || cols;
            const rowStart = r > 0 ? rowSizes.slice(0, r).reduce((sum, s) => sum + s, 0) / totalRowHeight : 0;
            const rowHeight = (rowSizes[r] || 1) / totalRowHeight;
            let cumWidth = 0;
            for (let c = 0; c < sessionsInRow - 1; c++) {
                cumWidth += (rowCellWidths[c] || 1) / totalRowWidth;
                resizers.push(
                    <div key={`v-${r}-${c}`} className="grid-resizer vertical"
                         style={{ position: 'absolute', left: `calc(${cumWidth * 100}% - 1.5px)`, top: `${rowStart * 100}%`, width: 3, height: `${rowHeight * 100}%`, cursor: "col-resize", zIndex: 10 }}
                         onMouseDown={(e) => handleResizerMouseDown(e, "vertical", c, r)} />
                );
            }
        }
        return resizers;
    };

    const getSessionStyle = (session) => {
        if (layoutMode === "single") {
            const v = session.id === activeSessionId;
            return { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: v ? 1 : -1, opacity: v ? 1 : 0, pointerEvents: v ? "auto" : "none" };
        }
        const gridIndex = gridSessions.indexOf(session.id);
        if (gridIndex === -1) return { position: "absolute", opacity: 0, pointerEvents: "none", zIndex: -1 };

        const { rows, cols } = getDynamicLayout(gridSessions.length);
        const rowIdx = Math.floor(gridIndex / cols), colIdx = gridIndex % cols;
        const totalRowHeight = rowSizes.reduce((sum, s) => sum + s, 0) || rows;
        const rowStart = rowIdx > 0 ? rowSizes.slice(0, rowIdx).reduce((sum, s) => sum + s, 0) / totalRowHeight * 100 : 0;
        const rowHeight = (rowSizes[rowIdx] || 1) / totalRowHeight * 100;
        const sessionsInRow = Math.min(cols, gridSessions.length - rowIdx * cols);
        const rowCellWidths = (cellSizes[rowIdx] || Array(sessionsInRow).fill({ width: 1 })).slice(0, sessionsInRow).map(c => c?.width ?? 1);
        const totalRowWidth = rowCellWidths.reduce((sum, w) => sum + w, 0) || sessionsInRow;
        const colStart = colIdx > 0 ? rowCellWidths.slice(0, colIdx).reduce((sum, w) => sum + w, 0) / totalRowWidth * 100 : 0;
        const spanFull = gridIndex === gridSessions.length - 1 && rowIdx === rows - 1 && gridSessions.length - (rows - 1) * cols === 1;
        const colWidth = spanFull ? 100 : (rowCellWidths[colIdx] || 1) / totalRowWidth * 100;

        // Add gaps for dividers
        const gapSize = 3; // 3px gap for dividers
        const isFirstRow = rowIdx === 0;
        const isLastRow = rowIdx === rows - 1;
        const isFirstCol = colIdx === 0;
        const isLastCol = spanFull || colIdx === sessionsInRow - 1;

        const topAdjust = isFirstRow ? 0 : gapSize / 2;
        const bottomAdjust = isLastRow ? 0 : gapSize / 2;
        const leftAdjust = isFirstCol ? 0 : gapSize / 2;
        const rightAdjust = isLastCol ? 0 : gapSize / 2;

        return { 
            position: "absolute", 
            top: `calc(${rowStart}% + ${topAdjust}px)`, 
            left: spanFull ? 0 : `calc(${colStart}% + ${leftAdjust}px)`, 
            width: spanFull ? '100%' : `calc(${colWidth}% - ${leftAdjust + rightAdjust}px)`, 
            height: `calc(${rowHeight}% - ${topAdjust + bottomAdjust}px)`, 
            zIndex: 1 
        };
    };

    const renderAllSessions = () => activeSessions.map(session => {
        if (!session?.server) return null;
        const isVisible = layoutMode === "single" ? session.id === activeSessionId : gridSessions.includes(session.id);
        return (
            <div key={session.id} ref={el => sessionRefs.current[session.id] = el}
                 className={`session-renderer ${isVisible ? "visible" : "hidden"}`}
                 onClick={() => session.id !== activeSessionId && focusSession(session.id)}
                 style={getSessionStyle(session)}>
                {renderRenderer(session)}
            </div>
        );
    });

    return (
        <div className={`view-container ${fullscreenMode ? "fullscreen" : ""}`}>
            {fullscreenMode && (
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
            {!fullscreenMode && <ServerTabs activeSessions={activeSessions} setActiveSessionId={focusSession}
                                            activeSessionId={activeSessionId}
                                            closeSession={closeSession}
                                            layoutMode={layoutMode} onToggleSplit={toggleSplitMode}
                                            orderRef={tabOrderRef}
                                            onTabOrderChange={onTabOrderChange} onBroadcastToggle={toggleBroadcastMode}
                                            onSnippetSelected={handleSnippetSelected} broadcastEnabled={broadcastMode}
                                            onKeyboardShortcut={handleKeyboardShortcut} hasGuacamole={hasGuacamole}
                                            sessionProgress={sessionProgress} fullscreenEnabled={fullscreenMode}
                                            onFullscreenToggle={toggleFullscreenMode}
                                            hibernateSession={hibernateSession} duplicateSession={duplicateSession} />}

            <div ref={layoutRef}
                 className={`view-layouter ${layoutMode} ${isResizing ? "resizing" : ""} ${isResizing && resizingDirection ? `resizing-${resizingDirection}` : ""}`}
                 style={{ position: "relative", width: "100%", height: "100%" }}>
                {renderAllSessions()}
                {layoutMode !== "single" && renderFlexLayout()}
            </div>
        </div>
    );
};