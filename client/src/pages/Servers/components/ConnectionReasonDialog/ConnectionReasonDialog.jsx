import { useState } from "react";
import { DialogProvider } from "@/common/components/Dialog";
import Button from "@/common/components/Button";
import "./styles.sass";

const ConnectionReasonDialog = ({ isOpen, onClose, onConnect, serverName }) => {
    const [reason, setReason] = useState("");

    const handleConnect = () => {
        if (reason.trim()) {
            onConnect(reason.trim());
            setReason("");
        }
    };

    const handleCancel = () => {
        setReason("");
        onClose();
    };

    const handleKeyPress = (e) => {
        if (e.key === "Enter" && reason.trim()) {
            handleConnect();
        } else if (e.key === "Escape") {
            handleCancel();
        }
    };

    return (
        <DialogProvider open={isOpen} onClose={handleCancel}>
            <div className="connection-reason-dialog">
                <h2>Connection Reason Required</h2>

                <div className="form-group">
                    <label htmlFor="reason">
                        Please provide a reason for connecting to <strong>{serverName}</strong>:
                    </label>

                    <textarea value={reason} onChange={(e) => setReason(e.target.value)} onKeyDown={handleKeyPress}
                              placeholder="Enter your reason for this connection..." className="reason-input" autoFocus
                              rows={3} maxLength={500} id="reason" />

                    <div className="character-count">
                        {reason.length}/500
                    </div>
                </div>

                <div className="dialog-actions">
                    <Button type="secondary" text="Cancel" onClick={handleCancel} />
                    <Button text="Connect" onClick={handleConnect} disabled={!reason.trim()} />
                </div>
            </div>
        </DialogProvider>
    );
};

export default ConnectionReasonDialog;
