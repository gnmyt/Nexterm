import "./styles.sass";
import ServerTabs from "./components/ServerTabs";
import { useContext, useState, useRef, useCallback, useEffect } from "react";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import GuacamoleRenderer from "@/pages/Servers/components/ViewContainer/renderer/GuacamoleRenderer.jsx";
import XtermRenderer from "@/pages/Servers/components/ViewContainer/renderer/XtermRenderer.jsx";
import FileRenderer from "@/pages/Servers/components/ViewContainer/renderer/FileRenderer";

export const ViewContainer = ({ activeSessions, activeSessionId, setActiveSessionId, disconnectFromServer }) => {

    const { getServerById, getPVEContainerById } = useContext(ServerContext);
    const [layoutMode, setLayoutMode] = useState("single");
    const [gridSessions, setGridSessions] = useState([]);
    const sessionRefs = useRef({});
    const tabOrderRef = useRef([]);

    const [columnSizes, setColumnSizes] = useState([]);
    const [rowSizes, setRowSizes] = useState([]);
    const [isResizing, setIsResizing] = useState(false);
    const [resizingDirection, setResizingDirection] = useState(null);
    const resizeRef = useRef(null);
    const layoutRef = useRef(null);

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

        setColumnSizes(newColumnSizes);
        setRowSizes(newRowSizes);
    }, []);

    const handleResizerMouseDown = useCallback((e, type, index) => {
        e.preventDefault();
        setIsResizing(true);
        setResizingDirection(type);

        const layoutElement = layoutRef.current;
        if (!layoutElement) return;

        const layoutRect = layoutElement.getBoundingClientRect();
        const totalSize = type === "vertical" ? layoutRect.width : layoutRect.height;
        const layoutStart = type === "vertical" ? layoutRect.left : layoutRect.top;

        const initialSizes = type === "vertical" ? [...columnSizes] : [...rowSizes];
        const totalInitialSize = initialSizes.reduce((sum, size) => sum + size, 0);

        const handleMouseMove = (moveEvent) => {
            const currentPos = type === "vertical" ? moveEvent.clientX : moveEvent.clientY;
            const relativePos = Math.max(0, Math.min(totalSize, currentPos - layoutStart));
            const mouseRatio = relativePos / totalSize;

            if (type === "vertical") {
                setColumnSizes(prev => {
                    const newSizes = [...prev];
                    if (index < newSizes.length - 1) {
                        const sizesBeforeResizer = initialSizes.slice(0, index);
                        const totalBefore = sizesBeforeResizer.reduce((sum, size) => sum + size, 0);

                        const twoColumnTotal = initialSizes[index] + initialSizes[index + 1];

                        const targetFirstColumn = (mouseRatio * totalInitialSize) - totalBefore;
                        const clampedFirstColumn = Math.max(0.1, Math.min(twoColumnTotal - 0.1, targetFirstColumn));

                        newSizes[index] = clampedFirstColumn;
                        newSizes[index + 1] = twoColumnTotal - clampedFirstColumn;
                    }
                    return newSizes;
                });
            } else {
                setRowSizes(prev => {
                    const newSizes = [...prev];
                    if (index < newSizes.length - 1) {
                        const sizesBeforeResizer = initialSizes.slice(0, index);
                        const totalBefore = sizesBeforeResizer.reduce((sum, size) => sum + size, 0);

                        const twoRowTotal = initialSizes[index] + initialSizes[index + 1];

                        const targetFirstRow = (mouseRatio * totalInitialSize) - totalBefore;
                        const clampedFirstRow = Math.max(0.1, Math.min(twoRowTotal - 0.1, targetFirstRow));

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
    }, [columnSizes, rowSizes]);

    const createResizers = useCallback((layout) => {
        const { rows, cols } = layout;
        const resizers = [];

        for (let col = 0; col < cols - 1; col++) {
            resizers.push(
                <div key={`v-resizer-${col}`} className="grid-resizer vertical"
                     style={{
                         gridColumn: `${col + 2} / ${col + 2}`, gridRow: `1 / ${rows + 1}`, width: "6px",
                         cursor: "col-resize", zIndex: 10, position: "relative", marginLeft: "-3px",
                     }}
                     onMouseDown={(e) => handleResizerMouseDown(e, "vertical", col)}
                />,
            );
        }

        for (let row = 0; row < rows - 1; row++) {
            resizers.push(
                <div key={`h-resizer-${row}`} className="grid-resizer horizontal"
                     style={{
                         gridColumn: `1 / ${cols + 1}`, gridRow: `${row + 2} / ${row + 2}`, height: "6px",
                         cursor: "row-resize", zIndex: 10, position: "relative", marginTop: "-3px",
                     }}
                     onMouseDown={(e) => handleResizerMouseDown(e, "horizontal", row)} />,
            );
        }

        return resizers;
    }, [handleResizerMouseDown]);

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
        }
    };

    useEffect(() => {
        if (layoutMode !== "single") {
            const newMode = getOptimalLayout(activeSessions.length);

            if (newMode !== layoutMode) setLayoutMode(newMode);

            const orderedSessionIds = tabOrderRef.current && tabOrderRef.current.length > 0 ? tabOrderRef.current
                : activeSessions.map(s => s.id);
            setGridSessions(orderedSessionIds);

            const layout = getDynamicLayout(activeSessions.length);
            initializeGridSizes(layout);
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

    const renderSession = (session) => {
        if (!session) return null;

        const isPVE = session.containerId !== undefined;
        const server = session.containerId !== undefined ? getPVEContainerById(session.server, session.containerId) : getServerById(session.server);

        if (!server) return null;

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
                {(server.protocol === "vnc" || server.protocol === "rdp") &&
                    <GuacamoleRenderer session={session} disconnectFromServer={disconnectFromServer} />}
                {server.protocol === "ssh" && session.type === "ssh"
                    && <XtermRenderer session={session} disconnectFromServer={disconnectFromServer} />}

                {server.protocol === "ssh" && session.type === "sftp"
                    && <FileRenderer session={session} disconnectFromServer={disconnectFromServer} />}

                {isPVE && server.type === "pve-qemu" &&
                    <GuacamoleRenderer session={session} disconnectFromServer={disconnectFromServer} pve />}

                {isPVE && (server.type === "pve-shell" || server.type === "pve-lxc") &&
                    <XtermRenderer session={session} disconnectFromServer={disconnectFromServer} pve />}
            </div>
        );
    };
    return (
        <div className="view-container">
            <ServerTabs activeSessions={activeSessions} setActiveSessionId={focusSession}
                        activeSessionId={activeSessionId} disconnectFromServer={disconnectFromServer}
                        layoutMode={layoutMode} onToggleSplit={toggleSplitMode} orderRef={tabOrderRef}
                        onTabOrderChange={onTabOrderChange} />

            <div ref={layoutRef}
                 className={`view-layouter ${layoutMode} ${isResizing ? "resizing" : ""} ${isResizing && resizingDirection ? `resizing-${resizingDirection}` : ""}`}
                 style={layoutMode !== "single" ? {
                     "--grid-rows": getDynamicLayout(gridSessions.length).rows,
                     "--grid-cols": getDynamicLayout(gridSessions.length).cols,
                     gridTemplateColumns: columnSizes.length > 0 ?
                         columnSizes.map(size => `${size}fr`).join(" ") :
                         `repeat(${getDynamicLayout(gridSessions.length).cols}, 1fr)`,
                     gridTemplateRows: rowSizes.length > 0 ?
                         rowSizes.map(size => `${size}fr`).join(" ") :
                         `repeat(${getDynamicLayout(gridSessions.length).rows}, 1fr)`,
                 } : {}}>
                {activeSessions.map(session => renderSession(session))}

                {layoutMode !== "single" && gridSessions.length > 1 &&
                    createResizers(getDynamicLayout(gridSessions.length))}
            </div>
        </div>
    );
};