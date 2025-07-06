import { DialogProvider } from "@/common/components/Dialog";
import Button from "@/common/components/Button";
import { mdiAlertCircleOutline, mdiClose, mdiContentCopy } from "@mdi/js";
import Icon from "@mdi/react";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import "./styles.sass";

export const MessageBoxDialog = ({ open, onClose, messageData }) => {
    const { sendToast } = useToast();

    if (!messageData) return null;

    const copyToClipboard = async (text, label) => {
        try {
            await navigator.clipboard.writeText(text);
            sendToast("Copied", `${label} copied to clipboard`);
        } catch (err) {
            sendToast("Error", `Failed to copy ${label} to clipboard`);
        }
    };

    const renderMessage = (message) => {
        const processedMessage = message.replace(/\\n/g, "\n");
        return processedMessage.split("\n").map((line, index, array) => (
            <span key={index}>
                {line}
                {index < array.length - 1 && <br />}
            </span>
        ));
    };

    const copyMessage = () => {
        const fullText = `${messageData.title}\n${"=".repeat(messageData.title.length)}\n\n${messageData.message}`;
        copyToClipboard(fullText, "Message");
    };

    return (
        <DialogProvider open={open} onClose={onClose} maxWidth="500px">
            <div className="msgbox-dialog">
                <div className="dialog-title">
                    <Icon path={mdiAlertCircleOutline} />
                    <h2>{messageData.title}</h2>
                </div>

                <div className="msgbox-content">
                    <div className="message-text">
                        {renderMessage(messageData.message)}
                    </div>
                </div>

                <div className="dialog-actions">
                    <Button onClick={copyMessage} text="Copy Message" icon={mdiContentCopy} type="secondary" />
                    <Button onClick={onClose} text="OK" icon={mdiClose} />
                </div>
            </div>
        </DialogProvider>
    );
};
