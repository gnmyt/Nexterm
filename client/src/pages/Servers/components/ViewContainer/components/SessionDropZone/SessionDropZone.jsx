import { useRef, useState } from "react";
import { useDrop } from "react-dnd";
import "./styles.sass";

const EDGE_THRESHOLD = 0.3;

const computeEdge = (offsetX, offsetY, width, height) => {
    if (width <= 0 || height <= 0) return "center";
    const distances = {
        left: offsetX / width,
        right: 1 - offsetX / width,
        top: offsetY / height,
        bottom: 1 - offsetY / height,
    };
    const [edge, distance] = Object.entries(distances).sort((a, b) => a[1] - b[1])[0];
    return distance < EDGE_THRESHOLD ? edge : "center";
};

export const SessionDropZone = ({ rect, sessionId, onDrop }) => {
    const elementRef = useRef(null);
    const edgeRef = useRef("center");
    const [edge, setEdge] = useState(null);

    const [{ isOver }, drop] = useDrop({
        accept: ["TAB", "server"],
        hover: (item, monitor) => {
            const element = elementRef.current;
            const offset = monitor.getClientOffset();
            if (!element || !offset) return;
            const bounds = element.getBoundingClientRect();
            const next = computeEdge(offset.x - bounds.left, offset.y - bounds.top, bounds.width, bounds.height);
            edgeRef.current = next;
            setEdge(current => current === next ? current : next);
        },
        drop: (item, monitor) => {
            onDrop(monitor.getItemType(), item, edgeRef.current);
            return { handled: true };
        },
        collect: (monitor) => ({ isOver: monitor.isOver() }),
    });

    const previewEdge = isOver ? edge : null;

    return (
        <div ref={(node) => {
            elementRef.current = node;
            drop(node);
        }}
             className={`session-drop-zone${isOver ? " over" : ""}`}
             data-session-id={sessionId}
             style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}>
            <div className={`drop-preview${previewEdge ? ` ${previewEdge}` : ""}`} />
        </div>
    );
};
