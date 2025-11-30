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

export const ViewContainer = ({
                                  activeSessions,
                                  activeSessionId,
                                  setActiveSessionId,
                                  disconnectFromServer,
                                  hibernateSession,
                                  setOpenFileEditors,
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
        if (refs) {
            terminalRefs.current[sessionId] = refs;
        } else {
            delete terminalRefs.current[sessionId];
        }
    }, []);

    const registerGuacamoleRef = useCallback((sessionId, refs) => {
        if (refs) {
            guacamoleRefs.current[sessionId] = refs;
        } else {
            delete guacamoleRefs.current[sessionId];
        }
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

    const initializeGridSizes = useCallback((layout) => {
        const { rows, cols } = layout;

        const newColumnSizes = Array(cols).fill(1);
        const newRowSizes = Array(rows).fill(1);

        const newCellSizes = [];
        for (let r = 0; r < rows; r++) {
            newCellSizes[r] = [];
            for (let c = 0; c < cols; c++) {
                newCellSizes[r][c] = { width: 1, height: 1 };
            }
        }

        setColumnSizes(newColumnSizes);
        setRowSizes(newRowSizes);
        setCellSizes(newCellSizes);
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

    const getDynamicLayout = (sessionCount) => {
        if (sessionCount <= 1) return { mode: "single", rows: 1, cols: 1 };
        if (sessionCount === 2) return { mode: "grid-2x1", rows: 1, cols: 2 };
        if (sessionCount === 3) return { mode: "grid-3", rows: 2, cols: 2 };
        if (sessionCount === 4) return { mode: "grid-2x2", rows: 2, cols: 2 };
        if (sessionCount === 5) return { mode: "grid-5", rows: 3, cols: 2 };
        if (sessionCount === 6) return { mode: "grid-3x2", rows: 2, cols: 3 };
        const cols = Math.ceil(Math.sqrt(sessionCount));
        const rows = Math.ceil(sessionCount / cols);
        return { mode: `grid-${rows}x${cols}`, rows, cols };
    };

    const getOptimalLayout = (sessionCount) => getDynamicLayout(sessionCount).mode;

    const toggleSplitMode = () => {
        if (layoutMode === "single") {
            const newMode = getOptimalLayout(activeSessions.length);
            setLayoutMode(newMode);

            const orderedSessionIds = tabOrderRef.current && tabOrderRef.current.length > 0 ? tabOrderRef.current
                : activeSessions.map(s => s.id);
            setGridSessions(orderedSessionIds);

            const layout = getDynamicLayout(activeSessions.length);
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
        if (layoutMode !== "single") {
            const newMode = getOptimalLayout(activeSessions.length);

            if (newMode !== layoutMode) setLayoutMode(newMode);

            const orderedSessionIds = tabOrderRef.current && tabOrderRef.current.length > 0 ? tabOrderRef.current
                : activeSessions.map(s => s.id);
            setGridSessions(orderedSessionIds);

            if (prevSessionCountRef.current !== activeSessions.length) {
                const layout = getDynamicLayout(activeSessions.length);
                initializeGridSizes(layout);
                prevSessionCountRef.current = activeSessions.length;
            }
        }
    }, [activeSessions, layoutMode, initializeGridSizes]);

    useEffect(() => {
        if (activeSessionId && activeSessions.some(session => session.id === activeSessionId)) {
            focusSession(activeSessionId);
        }
    }, [activeSessions.length, activeSessionId, focusSession]);

    const getSessionPosition = (sessionId) => {
        if (layoutMode === "single") {
            return { visible: sessionId === activeSessionId, gridIndex: -1 };
        }

        const gridIndex = gridSessions.indexOf(sessionId);
        return { visible: gridIndex !== -1, gridIndex };
    };

    const getGridArea = (gridIndex, layoutMode, totalSessions) => {
        if (gridIndex === -1) return "auto";

        const layout = getDynamicLayout(totalSessions);
        const { rows, cols } = layout;

        const row = Math.floor(gridIndex / cols) + 1;
        const col = (gridIndex % cols) + 1;

        const isLastRow = row === rows;
        const sessionsInLastRow = totalSessions - (rows - 1) * cols;
        const isAloneInLastRow = isLastRow && sessionsInLastRow === 1 && gridIndex === totalSessions - 1;

        if (isAloneInLastRow) return `${row} / 1 / ${row + 1} / ${cols + 1}`;

        return `${row} / ${col} / ${row + 1} / ${col + 1}`;
    };

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
                                     setOpenFileEditors={setOpenFileEditors} />;
            default:
                return <p>Unknown renderer: {renderer}</p>;
        }
    };

    const getSessionByGridIndex = (index) => {
        const sessionId = gridSessions[index];
        return activeSessions.find(s => s.id === sessionId);
    };

    const renderFlexLayout = () => {
        const layout = getDynamicLayout(gridSessions.length);
        const { rows, cols } = layout;

        const rowElements = [];

        for (let rowIdx = 0; rowIdx < rows; rowIdx++) {
            const rowHeight = rowSizes[rowIdx] || 1;
            const totalRowHeight = rowSizes.reduce((sum, s) => sum + s, 0) || rows;
            const rowHeightPercent = (rowHeight / totalRowHeight) * 100;

            const colElements = [];

            for (let colIdx = 0; colIdx < cols; colIdx++) {
                const gridIndex = rowIdx * cols + colIdx;
                if (gridIndex >= gridSessions.length) continue;

                const session = getSessionByGridIndex(gridIndex);
                if (!session) continue;

                const cellWidth = cellSizes[rowIdx]?.[colIdx]?.width ?? columnSizes[colIdx] ?? 1;
                const rowCellWidths = cellSizes[rowIdx]
                    ? cellSizes[rowIdx].slice(0, Math.min(cols, gridSessions.length - rowIdx * cols)).map(c => c?.width ?? 1)
                    : columnSizes.slice(0, Math.min(cols, gridSessions.length - rowIdx * cols));
                const totalRowWidth = rowCellWidths.reduce((sum, w) => sum + w, 0) || cols;
                const cellWidthPercent = (cellWidth / totalRowWidth) * 100;

                const handleSessionClick = () => {
                    if (session.id !== activeSessionId) focusSession(session.id);
                };

                colElements.push(
                    <div
                        key={session.id}
                        ref={el => sessionRefs.current[session.id] = el}
                        className="session-renderer visible"
                        onClick={handleSessionClick}
                        style={{
                            flex: `0 0 ${cellWidthPercent}%`,
                            height: "100%",
                            position: "relative",
                            overflow: "hidden",
                        }}
                    >
                        {renderRenderer(session)}
                    </div>,
                );

                if (colIdx < cols - 1 && gridIndex + 1 < gridSessions.length) {
                    colElements.push(
                        <div
                            key={`v-resizer-${rowIdx}-${colIdx}`}
                            className="grid-resizer vertical"
                            style={{
                                width: "6px",
                                cursor: "col-resize",
                                zIndex: 10,
                                flexShrink: 0,
                            }}
                            onMouseDown={(e) => handleResizerMouseDown(e, "vertical", colIdx, rowIdx)}
                        />,
                    );
                }
            }

            rowElements.push(
                <div
                    key={`row-${rowIdx}`}
                    className="grid-row"
                    style={{
                        display: "flex",
                        flex: `0 0 ${rowHeightPercent}%`,
                        width: "100%",
                        overflow: "hidden",
                    }}
                >
                    {colElements}
                </div>,
            );

            if (rowIdx < rows - 1) {
                rowElements.push(
                    <div
                        key={`h-resizer-row-${rowIdx}`}
                        className="grid-resizer horizontal"
                        style={{
                            height: "6px",
                            width: "100%",
                            cursor: "row-resize",
                            zIndex: 10,
                            flexShrink: 0,
                        }}
                        onMouseDown={(e) => handleResizerMouseDown(e, "horizontal", rowIdx, null)}
                    />,
                );
            }
        }

        return rowElements;
    };

    const renderSession = (session) => {
        if (!session) return null;

        if (!session.server) return null;

        const { visible, gridIndex } = getSessionPosition(session.id);
        const gridArea = layoutMode !== "single" ? getGridArea(gridIndex, layoutMode, gridSessions.length) : "auto";
        const layout = layoutMode !== "single" ? getDynamicLayout(gridSessions.length) : null;

        const handleSessionClick = () => {
            if (session.id !== activeSessionId) focusSession(session.id);
        };

        return (
            <div
                key={session.id}
                ref={el => sessionRefs.current[session.id] = el}
                className={`session-renderer ${visible ? "visible" : "hidden"}`}
                onClick={handleSessionClick}
                style={{
                    gridArea: layoutMode !== "single" && visible ? gridArea : "auto",
                    position: layoutMode === "single" ? "absolute" : "relative",
                    top: layoutMode === "single" ? 0 : "auto",
                    left: layoutMode === "single" ? 0 : "auto",
                    width: layoutMode === "single" ? "100%" : "auto",
                    height: layoutMode === "single" ? "100%" : "auto",
                    zIndex: visible ? 1 : -1,
                    ...(layout && { "--grid-rows": layout.rows, "--grid-cols": layout.cols }),
                }}
            >
                {renderRenderer(session)}
            </div>
        );
    };
    return (
        <div className={`view-container ${fullscreenMode ? "fullscreen" : ""}`}>
            {fullscreenMode && (
                <button className="exit-fullscreen-btn" onClick={toggleFullscreenMode}
                        title={t("servers.terminalActions.exitFullScreen")}>
                    <Icon path={mdiFullscreenExit} />
                </button>
            )}
            {!fullscreenMode && <ServerTabs activeSessions={activeSessions} setActiveSessionId={focusSession}
                                            activeSessionId={activeSessionId}
                                            disconnectFromServer={disconnectFromServer}
                                            layoutMode={layoutMode} onToggleSplit={toggleSplitMode}
                                            orderRef={tabOrderRef}
                                            onTabOrderChange={onTabOrderChange} onBroadcastToggle={toggleBroadcastMode}
                                            onSnippetSelected={handleSnippetSelected} broadcastEnabled={broadcastMode}
                                            onKeyboardShortcut={handleKeyboardShortcut} hasGuacamole={hasGuacamole}
                                            sessionProgress={sessionProgress} fullscreenEnabled={fullscreenMode}
                                            onFullscreenToggle={toggleFullscreenMode}
                                            hibernateSession={hibernateSession} />}

            <div ref={layoutRef}
                 className={`view-layouter ${layoutMode} ${isResizing ? "resizing" : ""} ${isResizing && resizingDirection ? `resizing-${resizingDirection}` : ""}`}
                 style={layoutMode !== "single" ? {
                     display: "flex",
                     flexDirection: "column",
                     width: "100%",
                     height: "100%",
                 } : {}}>
                {layoutMode === "single"
                    ? activeSessions.map(session => renderSession(session))
                    : renderFlexLayout()
                }
            </div>
        </div>
    );
};