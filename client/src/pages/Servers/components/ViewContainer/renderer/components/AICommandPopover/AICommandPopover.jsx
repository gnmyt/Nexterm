import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { mdiRobot, mdiSend, mdiContentCopy, mdiCheck } from "@mdi/js";
import Icon from "@mdi/react";
import { DialogProvider } from "@/common/components/Dialog";
import { postRequest } from "@/common/utils/RequestUtil.js";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import "./styles.sass";

export const AICommandPopover = ({ visible, onClose, onCommandGenerated, focusTerminal, entryId, recentOutput }) => {
    const { t } = useTranslation();
    const { sendToast } = useToast();
    const [prompt, setPrompt] = useState("");
    const [loading, setLoading] = useState(false);
    const [command, setCommand] = useState("");
    const [copied, setCopied] = useState(false);
    const inputRef = useRef(null);
    const cmdRef = useRef(null);

    useEffect(() => {
        if (visible) {
            setPrompt(""); setCommand(""); setCopied(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [visible]);

    const handleClose = () => { onClose(); focusTerminal?.(); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!prompt.trim() || loading) return;
        setLoading(true); setCommand("");
        try {
            const payload = { prompt: prompt.trim() };
            if (entryId) payload.entryId = entryId;
            if (recentOutput) payload.recentOutput = recentOutput;
            const res = await postRequest("ai/generate", payload);
            setCommand(res.command);
            setTimeout(() => cmdRef.current?.focus(), 50);
        } catch { sendToast("Error", t('servers.aiAssistant.error')); }
        finally { setLoading(false); }
    };

    const handleUse = () => { if (command.trim()) { onCommandGenerated(command); handleClose(); } };

    const handleCopy = () => {
        navigator.clipboard.writeText(command).then(() => {
            setCopied(true); setTimeout(() => setCopied(false), 1500);
        });
    };

    return (
        <DialogProvider open={visible} onClose={handleClose}>
            <div className="ai-dialog">
                <div className="ai-header"><Icon path={mdiRobot} /><h3>{t('servers.aiAssistant.title')}</h3></div>
                <form onSubmit={handleSubmit} className="ai-form">
                    <input ref={inputRef} type="text" value={prompt} onChange={(e) => setPrompt(e.target.value)}
                        placeholder={t('servers.aiAssistant.placeholder')} disabled={loading || command} />
                    <button type="submit" disabled={!prompt.trim() || loading || command}>
                        {loading ? <span className="ai-spinner" /> : <Icon path={mdiSend} />}
                    </button>
                </form>
                {command && !loading && (
                    <div className="ai-result">
                        <div className="ai-result-header">
                            <span className="ai-label">{t('servers.aiAssistant.generatedCommand')}</span>
                            <button className="ai-copy" onClick={handleCopy} title={t('servers.aiAssistant.copy')}>
                                <Icon path={copied ? mdiCheck : mdiContentCopy} />
                            </button>
                        </div>
                        <textarea ref={cmdRef} value={command} onChange={(e) => setCommand(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); handleUse(); } }} rows={3} />
                        <div className="ai-actions">
                            <button className="secondary" onClick={() => { setCommand(""); inputRef.current?.focus(); }}>
                                {t('servers.aiAssistant.tryAgain')}
                            </button>
                            <button className="primary" onClick={handleUse}>{t('servers.aiAssistant.useCommand')}</button>
                        </div>
                    </div>
                )}
                <div className="ai-hint">{command ? t('servers.aiAssistant.hintUse') : t('servers.aiAssistant.hint')}</div>
            </div>
        </DialogProvider>
    );
};