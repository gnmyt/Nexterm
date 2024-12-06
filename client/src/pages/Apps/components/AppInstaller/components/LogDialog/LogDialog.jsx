import "./styles.sass";
import { DialogProvider } from "@/common/components/Dialog";
import { useEffect, useRef, useState } from "react";
import { mdiCheck, mdiContentCopy } from "@mdi/js";
import Button from "@/common/components/Button";

export const LogDialog = ({open, onClose, content}) => {

    const [isCopied, toggleCopyState] = useState(false)

    const logRef = useRef();

    const handleCopyLogs = () => {
        toggleCopyState(true)

        navigator.clipboard.writeText(content)

        setTimeout(() => {
            toggleCopyState(false)
        }, 1500);
    }

    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [content]);

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="log-dialog">

                <div className="log-dialog-header">
                    <h2>Installation Log</h2>
                </div>

                <textarea className="log-dialog-content" ref={logRef} value={content} readOnly />

                <Button 
                    text={isCopied ? "Copied" : "Copy logs"}
                    icon={isCopied ? mdiCheck : mdiContentCopy}
                    onClick={handleCopyLogs}
                    disabled={isCopied}
                />
            </div>
        </DialogProvider>
    );
};