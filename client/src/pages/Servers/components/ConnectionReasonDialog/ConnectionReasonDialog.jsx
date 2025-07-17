import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DialogProvider } from "@/common/components/Dialog";
import Button from "@/common/components/Button";
import "./styles.sass";

const ConnectionReasonDialog = ({ isOpen, onClose, onConnect, serverName }) => {
    const { t } = useTranslation();
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
                <h2>{t('servers.connectionReasonDialog.title')}</h2>

                <div className="form-group">
                    <label htmlFor="reason">
                        <span dangerouslySetInnerHTML={{
                            __html: t('servers.connectionReasonDialog.reasonLabel', { serverName })
                        }} />
                    </label>

                    <textarea value={reason} onChange={(e) => setReason(e.target.value)} onKeyDown={handleKeyPress}
                              placeholder={t('servers.connectionReasonDialog.placeholder')} className="reason-input" autoFocus
                              rows={3} maxLength={500} id="reason" />

                    <div className="character-count">
                        {t('servers.connectionReasonDialog.characterCount', { count: reason.length })}
                    </div>
                </div>

                <div className="dialog-actions">
                    <Button type="secondary" text={t('servers.connectionReasonDialog.actions.cancel')} onClick={handleCancel} />
                    <Button text={t('servers.connectionReasonDialog.actions.connect')} onClick={handleConnect} disabled={!reason.trim()} />
                </div>
            </div>
        </DialogProvider>
    );
};

export default ConnectionReasonDialog;
