import { memo, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiCheck, mdiClose, mdiHelpCircleOutline, mdiSend, mdiStop } from "@mdi/js";
import MessageContent from "../MessageContent";
import { isPlainEnter } from "../../utils.js";
import "../ToolCard/styles.sass";
import "./styles.sass";

export const QuestionCard = memo(({ message, onAnswer }) => {
    const { t } = useTranslation();
    const [selected, setSelected] = useState([]);
    const [text, setText] = useState("");
    const inputRef = useRef(null);
    const { question, options = [], multiSelect = false, allowFreeText = true } = message.args || {};
    const open = message.status === "awaiting-answer";
    const answered = message.status === "done" && message.result?.answer !== undefined;

    useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

    const pick = (label) => {
        if (!multiSelect) return onAnswer(message.callId, label);
        setSelected((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]));
    };
    const submit = () => {
        const typed = text.trim();
        if (multiSelect && (selected.length || typed)) return onAnswer(message.callId, typed ? [...selected, typed] : selected);
        if (typed) onAnswer(message.callId, typed);
    };
    const canSubmit = Boolean(text.trim() || (multiSelect && selected.length));

    return (
        <div className={`tool-card question-card status-${message.status}`}>
            <div className="tool-head">
                <Icon path={mdiHelpCircleOutline} />
                <span className="tool-name">{t("servers.aiAssistant.tools.ask_user")}</span>
                <span className="tool-status">
                    {message.status === "done" && <Icon path={mdiCheck} />}
                    {message.status === "aborted" && <Icon path={mdiStop} />}
                    {message.status === "error" && <Icon path={mdiClose} />}
                </span>
            </div>
            <div className="question-text"><MessageContent text={question || ""} /></div>
            {open && (
                <div className="ai-composer question-composer" onClick={() => inputRef.current?.focus()}>
                    {options.length > 0 && (
                        <div className="ai-composer-context">
                            {options.map((option) => (
                                <button type="button" key={option.label} title={option.description || undefined}
                                        className={`ai-context-chip question-choice${multiSelect && selected.includes(option.label) ? " current" : ""}`}
                                        onClick={(e) => { e.stopPropagation(); pick(option.label); }}>
                                    {multiSelect && selected.includes(option.label) && <Icon path={mdiCheck} />}
                                    <span className="name">{option.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    {allowFreeText && (
                        <textarea ref={inputRef} rows={1} value={text} onChange={(e) => setText(e.target.value)}
                                  placeholder={options.length ? t("servers.aiAssistant.questionOther") : t("servers.aiAssistant.questionAnswer")}
                                  onKeyDown={(e) => { if (isPlainEnter(e)) { e.preventDefault(); submit(); } }} />
                    )}
                    <div className="ai-composer-footer">
                        <span className="ai-composer-status">
                            {options.length > 0 && (multiSelect ? t("servers.aiAssistant.questionPickMany") : t("servers.aiAssistant.questionPickOne"))}
                        </span>
                        <button type="button" className="ai-composer-send" onClick={submit} disabled={!canSubmit}
                                title={t("servers.aiAssistant.questionSend")}>
                            <Icon path={mdiSend} />
                        </button>
                    </div>
                </div>
            )}
            {answered && (
                <div className="question-answer">
                    {Array.isArray(message.result.answer) ? message.result.answer.join(", ") : String(message.result.answer)}
                </div>
            )}
            {message.status === "aborted" && <div className="tool-note">{t("servers.aiAssistant.stopped")}</div>}
            {message.status === "error" && <div className="tool-note error">{message.error}</div>}
        </div>
    );
});
