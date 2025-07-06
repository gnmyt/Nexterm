import { DialogProvider } from "@/common/components/Dialog";
import Button from "@/common/components/Button";
import { mdiInformationOutline, mdiClose, mdiContentCopy, mdiFileDocumentOutline, mdiOpenInNew } from "@mdi/js";
import Icon from "@mdi/react";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import "./styles.sass";

export const SummaryDialog = ({ open, onClose, summaryData }) => {
    const { sendToast } = useToast();

    if (!summaryData) return null;

    const parseDataToKeyValue = (data) => {
        const pairs = [];
        for (let i = 0; i < data.length; i += 2) {
            if (data[i] && data[i + 1]) pairs.push({ key: data[i], value: data[i + 1] });
        }
        return pairs;
    };

    const keyValuePairs = parseDataToKeyValue(summaryData.data || []);

    const isURL = (text) => {
        try {
            new URL(text);
            return true;
        } catch {
            return false;
        }
    };

    const openInNewTab = (url) => window.open(url, "_blank", "noopener,noreferrer");

    const copyToClipboard = async (text, label) => {
        try {
            await navigator.clipboard.writeText(text);
            sendToast("Copied", `${label} copied to clipboard`);
        } catch (err) {
            sendToast("Error", `Failed to copy ${label} to clipboard`);
        }
    };

    const copyAllSummary = () => {
        const summaryText = keyValuePairs
            .map(pair => `${pair.key}: ${pair.value}`)
            .join("\n");
        const fullText = `${summaryData.title}\n${"=".repeat(summaryData.title.length)}\n\n${summaryText}`;
        copyToClipboard(fullText, "Summary");
    };

    return (
        <DialogProvider open={open} onClose={onClose} maxWidth="500px">
            <div className="summary-dialog">
                <div className="dialog-title">
                    <Icon path={mdiInformationOutline} />
                    <h2>{summaryData.title}</h2>
                </div>

                <div className="summary-content">
                    {keyValuePairs.length > 0 ? (
                        <div className="summary-table">
                            {keyValuePairs.map((pair, index) => (
                                <div key={index} className="summary-row">
                                    <div className="summary-key">{pair.key}</div>
                                    <div className={`summary-value ${isURL(pair.value) ? "is-link" : ""}`}>
                                        {isURL(pair.value) ? (
                                            <a href={pair.value} target="_blank" rel="noopener noreferrer">
                                                {pair.value}
                                            </a>
                                        ) : pair.value}
                                    </div>
                                    <div className="action-buttons">
                                        {isURL(pair.value) && (
                                            <button className="open-button" onClick={() => openInNewTab(pair.value)}
                                                    title="Open in new tab">
                                                <Icon path={mdiOpenInNew} />
                                            </button>
                                        )}
                                        <button className="copy-button"
                                                onClick={() => copyToClipboard(pair.value, pair.key)}
                                                title={`Copy ${pair.key}`}>
                                            <Icon path={mdiContentCopy} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="no-data">
                            <p>No summary data available</p>
                        </div>
                    )}
                </div>

                <div className="dialog-actions">
                    {keyValuePairs.length > 0 && (
                        <Button onClick={copyAllSummary} text="Copy All" icon={mdiFileDocumentOutline}
                                type="secondary" />
                    )}
                    <Button onClick={onClose} text="Close" icon={mdiClose} />
                </div>
            </div>
        </DialogProvider>
    );
};
