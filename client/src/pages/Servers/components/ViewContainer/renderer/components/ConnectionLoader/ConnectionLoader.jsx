import { memo, useRef, useEffect, useCallback, useState } from "react";
import Icon from "@mdi/react";
import { mdiLaptop, mdiServer } from "@mdi/js";
import { beginProgress, endProgress } from "./progress.js";
import "./styles.sass";

export const ConnectionLoader = memo(({ onReady, sessionId }) => {
    const [startOffset] = useState(() => beginProgress(sessionId));
    const containerRef = useRef(null);
    const progressBarRef = useRef(null);
    const isHiddenRef = useRef(false);

    const hide = useCallback(() => {
        if (isHiddenRef.current) return;
        isHiddenRef.current = true;
        endProgress(sessionId);
        
        if (progressBarRef.current) {
            progressBarRef.current.classList.add("connection-loader__progress-bar--complete");
        }
        
        if (containerRef.current) {
            setTimeout(() => {
                if (containerRef.current) {
                    containerRef.current.classList.add("connection-loader--hidden");
                }
                setTimeout(() => {
                    if (containerRef.current) {
                        containerRef.current.style.display = "none";
                    }
                }, 200);
            }, 150);
        }
    }, [sessionId]);

    const show = useCallback(() => {
        if (!isHiddenRef.current) return;
        isHiddenRef.current = false;
        
        if (containerRef.current) {
            containerRef.current.style.display = "flex";
            containerRef.current.offsetHeight;
            containerRef.current.classList.remove("connection-loader--hidden");
        }
        if (progressBarRef.current) {
            progressBarRef.current.classList.remove("connection-loader__progress-bar--complete");
        }
    }, []);

    const isHidden = useCallback(() => isHiddenRef.current, []);

    useEffect(() => {
        if (onReady) {
            onReady({ hide, show, isHidden });
        }
    }, [onReady, hide, show, isHidden]);

    return (
        <div ref={containerRef} className="connection-loader">
            <div ref={progressBarRef} className="connection-loader__progress-bar"
                 style={startOffset ? { animationDelay: `-${startOffset}ms` } : undefined} />
            <div className="connection-loader__content">
                <div className="connection-loader__device">
                    <Icon path={mdiLaptop} className="connection-loader__device-icon" />
                </div>
                <div className="connection-loader__dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                <div className="connection-loader__device connection-loader__device--server">
                    <Icon path={mdiServer} className="connection-loader__device-icon" />
                </div>
            </div>
        </div>
    );
});

ConnectionLoader.displayName = "ConnectionLoader";