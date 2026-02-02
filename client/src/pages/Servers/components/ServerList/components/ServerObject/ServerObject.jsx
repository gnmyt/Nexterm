import Icon from "@mdi/react";
import { mdiSleep } from "@mdi/js";
import { getIconPath } from "@/common/utils/iconUtils.js";
import "./styles.sass";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import { useContext, useRef, useState } from "react";
import { useDrag, useDrop } from "react-dnd";
import { patchRequest } from "@/common/utils/RequestUtil.js";
import { DropIndicator } from "../DropIndicator";

export const ServerObject = ({ id, name, position, folderId, organizationId, nestedLevel, icon, type, connectToServer, status, tags = [], hibernatedSessionCount = 0, onTouchContextMenu }) => {
    const { loadServers, getServerById } = useContext(ServerContext);
    const [dropPlacement, setDropPlacement] = useState(null);
    const elementRef = useRef(null);
    const touchStartRef = useRef(null);
    const tapTimeoutRef = useRef(null);
    const lastTapRef = useRef(0);

    const [{ opacity }, dragRef] = useDrag({
        item: { type: "server", id, folderId, position },
        type: "server",
        collect: monitor => ({
            opacity: monitor.isDragging() ? 0.5 : 1,
        }),
    });

    const [{ isOver }, dropRef] = useDrop({
        accept: "server",
        hover: (item, monitor) => {
            if (!elementRef.current || item.id === id) return;
            
            const hoverBoundingRect = elementRef.current.getBoundingClientRect();
            const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
            const clientOffset = monitor.getClientOffset();
            const hoverClientY = clientOffset.y - hoverBoundingRect.top;

            const placement = hoverClientY < hoverMiddleY ? 'before' : 'after';
            setDropPlacement(placement);
        },
        drop: async (item) => {
            if (item.id === id) return;
            
            try {
                await patchRequest(`entries/${item.id}/reposition`, {
                    targetId: id,
                    placement: dropPlacement || 'after',
                    folderId: folderId,
                    organizationId: organizationId,
                });
                
                loadServers();
            } catch (error) {
                console.error("Failed to reposition entry", error);
            }
            
            setDropPlacement(null);
            return { id };
        },
        collect: (monitor) => ({
            isOver: monitor.isOver(),
        }),
    });

    const server = getServerById(id);

    const connect = () => {
        connectToServer(server.id, server.identities?.[0]);
    };

    return (
        <div 
            className={"server-object"}
            style={{ paddingLeft: `${15 + (nestedLevel * 15)}px`, opacity, position: 'relative' }} 
            data-id={id}
            ref={(node) => {
                elementRef.current = node;
                dragRef(dropRef(node));
            }}
            onDoubleClick={connect}
            onPointerDown={(e) => {
                if (e.pointerType === "touch") {
                    touchStartRef.current = { x: e.clientX, y: e.clientY };
                }
            }}
            onPointerUp={(e) => {
                if (e.pointerType === "touch") {
                    const start = touchStartRef.current;
                    const moved = start
                        ? Math.abs(e.clientX - start.x) > 10 || Math.abs(e.clientY - start.y) > 10
                        : false;
                    if (!moved) {
                        const now = Date.now();
                        if (tapTimeoutRef.current && now - lastTapRef.current < 300) {
                            clearTimeout(tapTimeoutRef.current);
                            tapTimeoutRef.current = null;
                            lastTapRef.current = 0;
                        } else {
                            lastTapRef.current = now;
                            tapTimeoutRef.current = setTimeout(() => {
                                onTouchContextMenu?.(e, id, "server-object");
                                tapTimeoutRef.current = null;
                                lastTapRef.current = 0;
                            }, 300);
                        }
                    }
                    touchStartRef.current = null;
                }
            }}
            onPointerCancel={() => {
                if (tapTimeoutRef.current) {
                    clearTimeout(tapTimeoutRef.current);
                    tapTimeoutRef.current = null;
                }
                touchStartRef.current = null;
                lastTapRef.current = 0;
            }}
            onMouseLeave={() => setDropPlacement(null)}>
            <DropIndicator show={isOver && dropPlacement === 'before'} placement="before" />
            <div className={
                type && type.startsWith('pve-') 
                    ? (status === 'offline' || status === 'stopped' ? "pve-icon pve-icon-offline" : "pve-icon")
                    : (status === 'offline' ? "system-icon system-icon-offline" : "system-icon")
            }>
                <Icon path={getIconPath(icon)} />
            </div>
            <p className="truncate-text">{name}</p>
            {hibernatedSessionCount > 0 && (
                <div className="hibernation-indicator" title={`${hibernatedSessionCount} hibernated session${hibernatedSessionCount > 1 ? 's' : ''}`}>
                    <Icon path={mdiSleep} />
                    <span>{hibernatedSessionCount}</span>
                </div>
            )}
            {tags && tags.length > 0 && (
                <div className="tag-circles">
                    {tags.map(tag => (
                        <div
                            key={tag.id}
                            className="tag-circle"
                            style={{ backgroundColor: tag.color }}
                            title={tag.name}
                        />
                    ))}
                </div>
            )}
            <DropIndicator show={isOver && dropPlacement === 'after'} placement="after" />
        </div>
    );
};