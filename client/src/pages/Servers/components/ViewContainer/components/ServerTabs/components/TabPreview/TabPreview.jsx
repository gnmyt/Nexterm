import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@mdi/react";
import { mdiNoteEditOutline } from "@mdi/js";
import { getIconPath } from "@/common/utils/iconUtils.js";
import "./styles.sass";

const CARD_WIDTH = 320;
const VIEWPORT_MARGIN = 8;
const TAB_GAP = 8;
const MAX_FRAME_HEIGHT = 220;
const EXIT_DURATION = 120;
const REPAINT_INTERVAL = 200;

const paintCanvases = (sourceCanvases, cloneCanvases) => {
    sourceCanvases.forEach((source, index) => {
        const target = cloneCanvases[index];
        if (!target || !source.width || !source.height) return;
        if (target.width !== source.width) target.width = source.width;
        if (target.height !== source.height) target.height = source.height;
        try {
            target.getContext("2d").drawImage(source, 0, 0);
        } catch {

        }
    });
};

const PreviewFrame = ({ sessionId, getSessionElement }) => {
    const frameRef = useRef(null);

    useLayoutEffect(() => {
        const frame = frameRef.current;
        const source = getSessionElement(sessionId);
        const width = source?.clientWidth, height = source?.clientHeight;
        if (!frame || !width || !height) {
            if (frame) frame.style.display = "none";
            return;
        }

        const scale = frame.clientWidth / width;
        const clone = source.cloneNode(true);
        const sourceNodes = source.querySelectorAll("*");
        const cloneNodes = clone.querySelectorAll("*");
        const sourceCanvases = source.querySelectorAll("canvas");
        const cloneCanvases = clone.querySelectorAll("canvas");

        clone.querySelectorAll("iframe, video, audio").forEach(node => node.remove());
        clone.className = "session-renderer tab-preview-clone";
        clone.removeAttribute("style");
        clone.inert = true;
        Object.assign(clone.style, { width: `${width}px`, height: `${height}px`, transform: `scale(${scale})` });

        frame.style.display = "";
        frame.style.height = `${Math.min(height * scale, MAX_FRAME_HEIGHT)}px`;
        frame.replaceChildren(clone);

        sourceNodes.forEach((node, index) => {
            const target = cloneNodes[index];
            if (node.tagName === "TEXTAREA" || node.tagName === "INPUT") target.value = node.value;
            if (node.scrollTop) target.scrollTop = node.scrollTop;
            if (node.scrollLeft) target.scrollLeft = node.scrollLeft;
        });

        if (sourceCanvases.length === 0) return;
        paintCanvases(sourceCanvases, cloneCanvases);
        const interval = setInterval(() => paintCanvases(sourceCanvases, cloneCanvases), REPAINT_INTERVAL);
        return () => clearInterval(interval);
    }, [sessionId, getSessionElement]);

    return <div className="tab-preview-frame" ref={frameRef} />;
};

export const TabPreview = ({ preview, getSessionElement }) => {
    const [shown, setShown] = useState(preview);
    if (preview && preview !== shown) setShown(preview);

    useEffect(() => {
        if (preview) return;
        const timer = setTimeout(() => setShown(null), EXIT_DURATION);
        return () => clearTimeout(timer);
    }, [preview]);

    if (!shown) return null;

    const { session, pageInfo, title, anchor } = shown;
    const width = Math.min(CARD_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
    const left = Math.max(VIEWPORT_MARGIN, Math.min(anchor.center - width / 2, window.innerWidth - width - VIEWPORT_MARGIN));
    const top = anchor.bottom + TAB_GAP;
    const subtitle = pageInfo?.title ? session.server?.name : null;

    return createPortal(
        <div className="tab-preview" style={{ width, transform: `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)` }}>
            <div className={`tab-preview-card${preview ? "" : " closing"}`}
                 style={{ transformOrigin: `${anchor.center - left}px 0` }}>
                <div className="tab-preview-header">
                    {pageInfo?.icon
                        ? <img src={pageInfo.icon} className="tab-preview-icon" alt="" />
                        : <Icon path={session.type === "notes" ? mdiNoteEditOutline : getIconPath(session.server?.icon)}
                                className="tab-preview-icon" />}
                    <div className="tab-preview-titles">
                        <span className="tab-preview-title">{title}</span>
                        {subtitle && <span className="tab-preview-subtitle">{subtitle}</span>}
                    </div>
                </div>
                <PreviewFrame sessionId={session.id} getSessionElement={getSessionElement} />
            </div>
        </div>,
        document.body,
    );
};
