import { DialogProvider } from "@/common/components/Dialog";
import "./styles.sass";
import { useEffect, useRef } from "react";

export const LogDialog = ({open, onClose, content}) => {

    const logRef = useRef();

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

                <div className="log-dialog-content" ref={logRef}>
                    <pre>
                        {content}
                    </pre>
                </div>
            </div>
        </DialogProvider>
    );
};