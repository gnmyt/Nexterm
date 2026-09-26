import Icon from "@mdi/react";
import { mdiSleep } from "@mdi/js";
import { getIconPath } from "@/common/utils/iconUtils.js";
import "./styles.sass";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import { useLiveSessions } from "@/common/contexts/LiveSessionContext.jsx";
import AvatarStack from "@/common/components/AvatarStack";
import { getSessionOwnerLabel } from "@/common/utils/avatar.js";
import { useTranslation } from "react-i18next";
import { useContext, useEffect, useRef, useState } from "react";
import { useDrag, useDrop } from "react-dnd";
import { patchRequest } from "@/common/utils/RequestUtil.js";
import { DropIndicator } from "../DropIndicator";
import { usePreferences } from "@/common/contexts/PreferencesContext.jsx";

const SCROLL_SPEED = 24;
const SCROLL_START_PAUSE_MS = 2000;
const SCROLL_END_PAUSE_MS = 3000;
const HOVER_END_PAUSE_MS = 2500;
const HOVER_RESET_MS = 80;

const ServerNote = ({ text, mode, isHovered }) => {
    const containerRef = useRef(null);
    const textRef = useRef(null);
    const trackRef = useRef(null);
    const animationRef = useRef(null);
    const hoveredRef = useRef(false);
    const [hoverPassDone, setHoverPassDone] = useState(false);
    const [dimensions, setDimensions] = useState({ containerWidth: 0, textWidth: 0 });
    const overflow = dimensions.textWidth > dimensions.containerWidth + 1;
    const hoverRun = mode === "hover" && isHovered && !hoverPassDone;
    const [reducedMotion, setReducedMotion] = useState(() =>
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
    );

    useEffect(() => {
        const container = containerRef.current;
        const content = textRef.current;
        if (!container || !content) return;

        const measure = () => {
            const next = { containerWidth: container.clientWidth, textWidth: content.scrollWidth };
            setDimensions(current => current.containerWidth === next.containerWidth && current.textWidth === next.textWidth ? current : next);
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(container);
        observer.observe(content);
        return () => observer.disconnect();
    }, [text]);

    useEffect(() => {
        const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
        if (!query) return;
        const update = () => setReducedMotion(query.matches);
        update();
        query.addEventListener?.("change", update);
        return () => query.removeEventListener?.("change", update);
    }, []);

    useEffect(() => {
        animationRef.current?.cancel();
        animationRef.current = null;
        if (!overflow || mode === "none" || reducedMotion || !trackRef.current || !textRef.current || !containerRef.current) return;
        if (mode === "hover" && !hoverRun) return;

        const { containerWidth: visibleWidth, textWidth: contentWidth } = dimensions;
        const distance = mode === "infinite"
            ? contentWidth + parseFloat(getComputedStyle(trackRef.current).columnGap || "0")
            : contentWidth - visibleWidth;
        if (distance <= 0) return;

        const travelMs = distance / SCROLL_SPEED * 1000;
        let keyframes;
        let duration;
        let iterations = Infinity;
        if (mode === "stop") {
            duration = travelMs + SCROLL_START_PAUSE_MS + SCROLL_END_PAUSE_MS;
            const startHold = SCROLL_START_PAUSE_MS / duration;
            const endHold = (SCROLL_START_PAUSE_MS + travelMs) / duration;
            keyframes = [
                { transform: "translateX(0)", offset: 0 },
                { transform: "translateX(0)", offset: startHold },
                { transform: `translateX(-${distance}px)`, offset: endHold },
                { transform: `translateX(-${distance}px)`, offset: 1 },
            ];
        } else if (mode === "hover") {
            duration = travelMs + HOVER_END_PAUSE_MS + HOVER_RESET_MS;
            const endHold = travelMs / duration;
            const resetStart = (travelMs + HOVER_END_PAUSE_MS) / duration;
            iterations = 1;
            keyframes = [
                { transform: "translateX(0)", offset: 0 },
                { transform: `translateX(-${distance}px)`, offset: endHold },
                { transform: `translateX(-${distance}px)`, offset: resetStart },
                { transform: "translateX(0)", offset: 1 },
            ];
        } else {
            duration = travelMs;
            keyframes = [
                { transform: "translateX(0)" },
                { transform: `translateX(-${distance}px)` },
            ];
        }

        animationRef.current = trackRef.current.animate(keyframes, {
            duration,
            iterations,
            easing: "linear",
        });
        const animation = animationRef.current;
        if (mode === "hover") {
            animation.onfinish = () => {
                animation.cancel();
                if (animationRef.current === animation) animationRef.current = null;
                setHoverPassDone(true);
            };
        } else if (hoveredRef.current) {
            animation.pause();
        }
        return () => {
            animationRef.current?.cancel();
            animationRef.current = null;
        };
    }, [mode, overflow, reducedMotion, text, dimensions, hoverRun]);

    useEffect(() => {
        hoveredRef.current = isHovered;
        if (isHovered) {
            setHoverPassDone(false);
            if (mode !== "hover") animationRef.current?.pause();
        } else if (mode !== "hover") {
            animationRef.current?.play();
        }
    }, [isHovered, mode]);

    const hoverAnimationActive = hoverRun && overflow && !reducedMotion;

    return (
        <span
            ref={containerRef}
            className={`server-note server-note--${mode} ${hoverAnimationActive ? "server-note--hover-active" : ""}`}
        >
            <span ref={trackRef} className="server-note-track">
                <span ref={textRef} className="server-note-text">{text}</span>
                {mode === "infinite" && overflow && (
                    <span className="server-note-text" aria-hidden="true">{text}</span>
                )}
            </span>
        </span>
    );
};

export const ServerObject = ({ id, name, position, folderId, organizationId, nestedLevel, icon, type, connectToServer, status, tags = [], hibernatedSessionCount = 0 }) => {
    const { loadServers, getServerById } = useContext(ServerContext);
    const { getLiveSessionsForEntry } = useLiveSessions();
    const { t } = useTranslation();
    const { serverNoteScrollMode } = usePreferences();
    const [dropPlacement, setDropPlacement] = useState(null);
    const [isServerHovered, setIsServerHovered] = useState(false);
    const elementRef = useRef(null);

    const isIntegrationEntry = Boolean(type?.startsWith("pve-"));

    const [{ opacity }, dragRef] = useDrag({
        item: { type: "server", id, folderId, position, isIntegrationEntry },
        type: "server",
        collect: monitor => ({
            opacity: monitor.isDragging() ? 0.5 : 1,
        }),
    });

    const [{ isOver }, dropRef] = useDrop({
        accept: "server",
        canDrop: (item) => item.isIntegrationEntry ? item.folderId === folderId : !isIntegrationEntry,
        hover: (item, monitor) => {
            if (!elementRef.current || item.id === id || !monitor.canDrop()) return;
            
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
            isOver: monitor.isOver() && monitor.canDrop(),
        }),
    });

    const server = getServerById(id);

    const liveSessions = getLiveSessionsForEntry(id);
    const liveSessionOwners = liveSessions.map(session => ({
        ...session.owner,
        sessionId: session.id,
    }));
    const liveSessionsTitle = liveSessions.length
        ? t("servers.liveSessions.activeOn", {
            users: [...new Set(liveSessions.map(s => getSessionOwnerLabel(s, t)))].join(", "),
        })
        : undefined;

    const connect = () => {
        connectToServer(server.id, server.identities?.[0]);
    };

    const noteLine = server?.showNoteInList
        ? (server?.notes || "").split(/\r?\n/)[0].trim()
        : "";

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
            onMouseEnter={() => setIsServerHovered(true)}
            onMouseLeave={() => {
                setIsServerHovered(false);
                setDropPlacement(null);
            }}>
            <DropIndicator show={isOver && dropPlacement === 'before'} placement="before" />
            <div className={
                type && type.startsWith('pve-') 
                    ? (status === 'offline' || status === 'stopped' ? "pve-icon pve-icon-offline" : "pve-icon")
                    : (status === 'offline' ? "system-icon system-icon-offline" : "system-icon")
            }>
                <Icon path={getIconPath(icon)} />
            </div>
            <div className="server-text">
                <p className="server-name truncate-text">{name}</p>
                {noteLine && <ServerNote text={noteLine} mode={serverNoteScrollMode || "none"} isHovered={isServerHovered} />}
            </div>
            {hibernatedSessionCount > 0 && (
                <div className="hibernation-indicator" title={`${hibernatedSessionCount} hibernated session${hibernatedSessionCount > 1 ? 's' : ''}`}>
                    <Icon path={mdiSleep} />
                    <span>{hibernatedSessionCount}</span>
                </div>
            )}
            <AvatarStack className="live-session-avatars" users={liveSessionOwners} max={2}
                         title={liveSessionsTitle} getKey={owner => owner.sessionId} />
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
