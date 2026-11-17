import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiCancel, mdiCheck, mdiChevronDown, mdiChevronUp, mdiClose, mdiStop } from "@mdi/js";
import Button from "@/common/components/Button";
import { FALLBACK_TOOL_META, TOOL_META } from "./toolMeta.js";
import { ToolResult } from "./ToolResult.jsx";
import "./styles.sass";

export const ToolCard = memo(({ message, onConfirm, acceptHint }) => {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);
    const meta = TOOL_META[message.tool] || FALLBACK_TOOL_META;
    const summary = meta.summary(message.args || {}, t) || "";
    const exitCode = message.status === "done" && message.result && !message.result.denied && typeof message.result.exitCode === "number"
        ? message.result.exitCode : null;
    const failed = (exitCode !== null && exitCode !== 0) || Boolean(message.result?.error);

    const settled = message.status !== "running" && message.status !== "awaiting-confirm";
    const open = !settled || expanded;
    const toggle = () => settled && setExpanded((prev) => !prev);
    const label = t(`servers.aiAssistant.tools.${message.tool}`, { defaultValue: message.tool });

    return (
        <div className={`tool-card status-${message.status}${failed ? " exit-failed" : ""}${settled ? " settled" : ""}`}>
            <div className="tool-head" onClick={toggle} role={settled ? "button" : undefined}
                 tabIndex={settled ? 0 : undefined} aria-expanded={settled ? open : undefined}
                 onKeyDown={(e) => { if (settled && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggle(); } }}>
                <Icon path={meta.icon} />
                <span className="tool-name">{label}</span>
                {!open && summary && <span className="tool-summary">{summary}</span>}
                <span className="tool-status">
                    {message.status === "running" && <span className="ai-spinner" />}
                    {message.status === "done" && (exitCode !== null && exitCode !== 0
                        ? <span className="tool-exit fail">{t("servers.aiAssistant.exitCode", { code: exitCode })}</span>
                        : failed ? <Icon path={mdiClose} /> : <Icon path={mdiCheck} />)}
                    {message.status === "denied" && <Icon path={mdiCancel} />}
                    {message.status === "aborted" && <Icon path={mdiStop} />}
                    {message.status === "error" && <Icon path={mdiClose} />}
                </span>
                {settled && <Icon className="tool-chevron" path={open ? mdiChevronUp : mdiChevronDown} />}
            </div>

            {open && summary && <div className="tool-target">{summary}</div>}

            {message.status === "awaiting-confirm" && (
                <div className="tool-confirm">
                    <span>{t("servers.aiAssistant.confirmPrompt")}</span>
                    <div className="confirm-actions">
                        <Button type="danger" icon={mdiCancel} text={t("servers.aiAssistant.deny")}
                                onClick={() => onConfirm(message.callId, false)} />
                        <Button icon={mdiCheck} text={t("servers.aiAssistant.allow")}
                                title={acceptHint ? t("servers.aiAssistant.allowShortcut", { key: acceptHint }) : undefined}
                                onClick={() => onConfirm(message.callId, true)} />
                    </div>
                    {acceptHint && <span className="confirm-hint">{t("servers.aiAssistant.allowShortcut", { key: acceptHint })}</span>}
                </div>
            )}

            {open && message.status === "denied" && <div className="tool-note">{t("servers.aiAssistant.denied")}</div>}
            {open && message.status === "aborted" && <div className="tool-note">{t("servers.aiAssistant.stopped")}</div>}
            {open && message.status === "error" && <div className="tool-note error">{message.error}</div>}
            {open && message.status === "done" && <ToolResult tool={message.tool} result={message.result} />}
        </div>
    );
});
