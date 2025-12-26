import { useEffect, useRef, useState, useCallback } from "react";
import Icon from "@mdi/react";
import { mdiPlay, mdiPause, mdiRewind, mdiFastForward, mdiLoading, mdiAlertCircleOutline } from "@mdi/js";
import Guacamole from "guacamole-common-js";
import * as AsciinemaPlayer from "asciinema-player";
import "asciinema-player/dist/bundle/asciinema-player.css";
import { DialogProvider } from "@/common/components/Dialog/Dialog.jsx";
import { getRawRequest } from "@/common/utils/RequestUtil.js";
import "./styles.sass";

const formatTime = (ms) => {
    if (!ms || isNaN(ms)) return "0:00";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
};

const RecordingPlayerContent = ({ auditLogId, recordingType }) => {
    const containerRef = useRef(null);
    const playerRef = useRef(null);
    const initRef = useRef(false);
    const [state, setState] = useState({ loading: true, error: null, playing: false, duration: 0, position: 0 });

    const updateState = (changes) => setState(prevState => ({ ...prevState, ...changes }));

    const handlePlayPause = useCallback(async () => {
        const player = playerRef.current;
        if (!player) return;
        if (state.playing) {
            await player.pause?.() || player.pause();
        } else {
            await player.play?.() || player.play();
        }
    }, [state.playing]);

    const handleSeek = useCallback(async (event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const percentage = (event.clientX - rect.left) / event.currentTarget.offsetWidth;
        const newPosition = percentage * state.duration;
        const player = playerRef.current;
        if (!player) return;
        if (recordingType === "guac") {
            player.seek(newPosition, () => updateState({ position: newPosition }));
        } else {
            await player.seek(newPosition / 1000);
            updateState({ position: newPosition });
        }
    }, [state.duration, recordingType]);

    const handleSkip = useCallback(async (delta) => {
        const newPosition = Math.max(0, Math.min(state.duration, state.position + delta));
        const player = playerRef.current;
        if (!player) return;
        if (recordingType === "guac") {
            player.seek(newPosition, () => updateState({ position: newPosition }));
        } else {
            await player.seek(newPosition / 1000);
            updateState({ position: newPosition });
        }
    }, [state.position, state.duration, recordingType]);

    useEffect(() => {
        if (!containerRef.current || initRef.current) return;
        initRef.current = true;
        containerRef.current.innerHTML = "";
        let cleanup = null;

        (async () => {
            try {
                const response = await getRawRequest(`audit/${auditLogId}/recording`);

                if (recordingType === "guac") {
                    const recording = new Guacamole.SessionRecording(await response.blob());
                    playerRef.current = recording;
                    const display = recording.getDisplay();
                    const displayElement = display.getElement();
                    containerRef.current.appendChild(displayElement);

                    const scaleDisplay = () => {
                        const displayWidth = display.getWidth();
                        const displayHeight = display.getHeight();
                        const containerWidth = containerRef.current.clientWidth;
                        const containerHeight = containerRef.current.clientHeight;
                        if (displayWidth && displayHeight && containerWidth && containerHeight) {
                            const scaleFactor = Math.min(containerWidth / displayWidth, containerHeight / displayHeight);
                            const offsetX = (containerWidth - displayWidth * scaleFactor) / 2;
                            const offsetY = (containerHeight - displayHeight * scaleFactor) / 2;
                            Object.assign(displayElement.style, {
                                position: "absolute", transform: `translate(${offsetX}px, ${offsetY}px) scale(${scaleFactor})`,
                                transformOrigin: "0 0", imageRendering: "crisp-edges"
                            });
                        }
                    };

                    recording.onload = () => { updateState({ duration: recording.getDuration(), loading: false }); recording.seek(0, () => setTimeout(scaleDisplay, 50)); };
                    recording.onprogress = (duration) => updateState({ duration });
                    recording.onseek = (position) => { updateState({ position }); scaleDisplay(); };
                    recording.onplay = () => updateState({ playing: true });
                    recording.onpause = () => updateState({ playing: false });
                    recording.onerror = (error) => updateState({ error: error?.message || "Playback error" });
                    window.addEventListener("resize", scaleDisplay);
                    cleanup = { clear: () => window.removeEventListener("resize", scaleDisplay) };
                } else {
                    const data = await response.text();
                    const lines = data.trim().split("\n");
                    let duration = 0;
                    if (lines.length > 1) {
                        try {
                            const lastEvent = JSON.parse(lines[lines.length - 1]);
                            duration = (lastEvent[0] || 0) * 1000;
                        } catch {}
                    }
                    updateState({ duration });

                    const terminalPlayer = AsciinemaPlayer.create(
                        { data },
                        containerRef.current,
                        { fit: false, autoPlay: false, preload: true, idleTimeLimit: 2, theme: "monokai", terminalFontFamily: "'Fira Code', monospace" }
                    );
                    playerRef.current = terminalPlayer;

                    const scaleTerminal = () => {
                        const wrapper = containerRef.current?.querySelector(".ap-wrapper");
                        const terminal = containerRef.current?.querySelector(".ap-term");
                        if (!wrapper || !terminal || !containerRef.current) return;

                        wrapper.style.transform = "none";
                        wrapper.style.position = "absolute";
                        wrapper.style.transformOrigin = "0 0";
                        wrapper.style.left = "0";
                        wrapper.style.top = "0";
                        
                        const containerWidth = containerRef.current.clientWidth;
                        const containerHeight = containerRef.current.clientHeight;
                        const terminalRect = terminal.getBoundingClientRect();
                        const terminalWidth = terminalRect.width;
                        const terminalHeight = terminalRect.height;
                        
                        if (terminalWidth > 0 && terminalHeight > 0 && containerWidth > 0 && containerHeight > 0) {
                            const scaleFactor = Math.min(containerWidth / terminalWidth, containerHeight / terminalHeight);
                            const offsetX = (containerWidth - terminalWidth * scaleFactor) / 2;
                            const offsetY = (containerHeight - terminalHeight * scaleFactor) / 2;
                            wrapper.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scaleFactor})`;
                        }
                    };

                    let resizeObserver = null;
                    const setupResizeObserver = () => {
                        const terminal = containerRef.current?.querySelector(".ap-term");
                        if (terminal && !resizeObserver) {
                            resizeObserver = new ResizeObserver(scaleTerminal);
                            resizeObserver.observe(terminal);
                        }
                    };

                    const scaleInterval = setInterval(scaleTerminal, 200);

                    terminalPlayer.addEventListener("playing", () => updateState({ playing: true }));
                    terminalPlayer.addEventListener("pause", () => updateState({ playing: false }));
                    terminalPlayer.addEventListener("ended", () => updateState({ playing: false }));
                    terminalPlayer.addEventListener("ready", () => { updateState({ loading: false }); setTimeout(() => { scaleTerminal(); setupResizeObserver(); }, 50); });
                    
                    window.addEventListener("resize", scaleTerminal);
                    const positionInterval = setInterval(async () => { try { updateState({ position: ((await playerRef.current?.getCurrentTime()) || 0) * 1000 }); } catch {} }, 250);
                    cleanup = { clear: () => { window.removeEventListener("resize", scaleTerminal); clearInterval(positionInterval); clearInterval(scaleInterval); resizeObserver?.disconnect(); } };
                }
            } catch (error) {
                updateState({ error: error.message || "Failed to load recording", loading: false });
            }
        })();

        return () => {
            if (cleanup?.clear) cleanup.clear();
            else if (cleanup) clearInterval(cleanup);
            playerRef.current?.pause?.();
            playerRef.current?.dispose?.();
            playerRef.current = null;
        };
    }, [auditLogId, recordingType]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === " ") { event.preventDefault(); handlePlayPause(); }
            else if (event.key === "ArrowLeft") handleSkip(-5000);
            else if (event.key === "ArrowRight") handleSkip(5000);
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [handlePlayPause, handleSkip]);

    return (
        <div className="recording-player-content">
            <h2>Session Recording</h2>
            <div className="recording-display-area">
                {state.loading && <div className="loading-state"><Icon path={mdiLoading} spin size={2} /><span>Loading recording...</span></div>}
                {state.error && <div className="error-state"><Icon path={mdiAlertCircleOutline} size={2} /><span>{state.error}</span></div>}
                <div className={`display-container ${recordingType}`} ref={containerRef} style={{ display: state.loading || state.error ? "none" : "block" }} />
            </div>
            {!state.loading && !state.error && (
                <div className="recording-controls">
                    <div className="controls-left">
                        <button className="control-btn" onClick={() => handleSkip(-10000)}><Icon path={mdiRewind} size={0.9} /></button>
                        <button className="control-btn play-btn" onClick={handlePlayPause}><Icon path={state.playing ? mdiPause : mdiPlay} size={1.2} /></button>
                        <button className="control-btn" onClick={() => handleSkip(10000)}><Icon path={mdiFastForward} size={0.9} /></button>
                    </div>
                    <div className="controls-center">
                        <span className="time-display">{formatTime(state.position)}</span>
                        <div className="progress-bar" onClick={handleSeek}>
                            <div className="progress-fill" style={{ width: `${state.duration > 0 ? (state.position / state.duration) * 100 : 0}%` }} />
                        </div>
                        <span className="time-display">{formatTime(state.duration)}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export const RecordingPlayer = ({ auditLogId, recordingType, onClose }) => (
    <DialogProvider open={true} onClose={onClose}>
        <RecordingPlayerContent auditLogId={auditLogId} recordingType={recordingType} />
    </DialogProvider>
);
