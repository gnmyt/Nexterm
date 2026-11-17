import { memo, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiCheck, mdiContentCopy, mdiPencilOutline, mdiSend } from "@mdi/js";
import Button from "@/common/components/Button";
import MessageContent from "../MessageContent";
import { autoGrow, isPlainEnter } from "../../utils.js";
import "./styles.sass";

export const UserMessage = memo(({ message, canEdit, onEdit }) => {
    const { t } = useTranslation();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState("");
    const [copied, setCopied] = useState(false);
    const editorRef = useRef(null);

    useEffect(() => {
        if (!editing) return;
        const el = editorRef.current;
        if (!el) return;
        autoGrow(el);
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
    }, [editing]);

    const copy = () => {
        navigator.clipboard?.writeText(message.text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        }).catch(() => {});
    };

    const submit = () => {
        const content = draft.trim();
        if (!content || !canEdit) return;
        setEditing(false);
        onEdit(message.id, content);
    };

    const handleKeyDown = (e) => {
        if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            setEditing(false);
        } else if (isPlainEnter(e)) {
            e.preventDefault();
            submit();
        }
    };

    if (editing) {
        return (
            <div className="message-user editing">
                <div className="message-editor">
                    <textarea ref={editorRef} rows={1} value={draft} onKeyDown={handleKeyDown}
                              aria-label={t("servers.aiAssistant.editMessage")}
                              onChange={(e) => { setDraft(e.target.value); autoGrow(e.target); }} />
                    <div className="message-editor-footer">
                        <Button type="secondary" text={t("common.actions.cancel")} onClick={() => setEditing(false)} />
                        <Button type="primary" icon={mdiSend} text={t("servers.aiAssistant.send")} onClick={submit}
                                disabled={!draft.trim() || !canEdit} />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="message-user">
            <div className="message user"><MessageContent text={message.text} /></div>
            <div className="message-actions">
                <button type="button" title={t(copied ? "servers.aiAssistant.copied" : "servers.aiAssistant.copyMessage")}
                        aria-label={t("servers.aiAssistant.copyMessage")} onClick={copy}>
                    <Icon path={copied ? mdiCheck : mdiContentCopy} />
                </button>
                {message.id && (
                    <button type="button" title={t("servers.aiAssistant.editMessage")} aria-label={t("servers.aiAssistant.editMessage")}
                            disabled={!canEdit} onClick={() => { setDraft(message.text); setEditing(true); }}>
                        <Icon path={mdiPencilOutline} />
                    </button>
                )}
            </div>
        </div>
    );
});
