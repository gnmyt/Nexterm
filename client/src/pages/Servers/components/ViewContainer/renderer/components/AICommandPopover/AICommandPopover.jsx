import { useState, useRef, useEffect } from "react";
import { mdiRobot, mdiSend, mdiClose, mdiLoading } from "@mdi/js";
import Icon from "@mdi/react";
import "./styles.sass";
import { postRequest } from "@/common/utils/RequestUtil.js";

export const AICommandPopover = ({ visible, onClose, onCommandGenerated, position, focusTerminal }) => {
    const [prompt, setPrompt] = useState("");
    const [loading, setLoading] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        if (visible && inputRef.current) inputRef.current.focus();
    }, [visible]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!prompt.trim()) return;

        setLoading(true);

        try {
            const response = await postRequest("ai/generate", { prompt: prompt.trim() });
            onCommandGenerated(response.command);
            setPrompt("");
            handleClose();
        } catch (error) {
            console.error("Error generating AI command:", error);
            setPrompt("");
            handleClose();
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Escape") {
            onClose();
            if (focusTerminal) {
                focusTerminal();
            }
        }
    };

    const handleClose = () => {
        onClose();
        if (focusTerminal) {
            focusTerminal();
        }
    };

    if (!visible) return null;

    const shouldShowBelow = position && position.y < 250;

    const popoverStyle = {
        left: position?.x || "50%",
        top: position?.y || "50%",
        transform: shouldShowBelow ? "translate(-50%, 0%)" : "translate(-50%, -100%)",
        marginTop: shouldShowBelow ? "30px" : "",
    };

    return (
        <div className="ai-command-popover-overlay">
            <div className="ai-command-popover" style={popoverStyle}>
                <div className="popover-header">
                    <div className="popover-title">
                        <Icon path={mdiRobot} />
                        <span>AI Assistant</span>
                    </div>
                    <button className="close-button" onClick={handleClose} aria-label="Close AI Assistant">
                        <Icon path={mdiClose} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="popover-form">
                    <div className="input-container">
                        <input ref={inputRef} type="text" value={prompt} onChange={(e) => setPrompt(e.target.value)}
                               onKeyDown={handleKeyDown} placeholder="Describe what you want to do..."
                               disabled={loading} className="prompt-input" />
                        <button type="submit" disabled={!prompt.trim() || loading} className="submit-button">
                            {loading ? <Icon path={mdiLoading} spin /> : <Icon path={mdiSend} />}
                        </button>
                    </div>
                </form>

                <div className="popover-hint">
                    Press <kbd>Enter</kbd> to generate • <kbd>Esc</kbd> to close
                </div>
            </div>
        </div>
    );
};