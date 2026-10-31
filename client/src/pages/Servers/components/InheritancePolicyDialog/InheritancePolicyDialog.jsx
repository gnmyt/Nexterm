import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import Button from "@/common/components/Button";
import "./styles.sass";

const InheritancePolicyDialog = ({ open, title, description, impact, onConfirm, onCancel }) => {
    const { t } = useTranslation();
    const [policy, setPolicy] = useState("retain");

    if (!open) return null;

    const cancel = () => {
        setPolicy("retain");
        onCancel();
    };
    const confirm = () => {
        onConfirm(policy);
        setPolicy("retain");
    };

    return createPortal(
        <div className="inheritance-policy-overlay" data-dialog-action>
            <dialog open className="inheritance-policy-dialog" aria-modal="true" aria-labelledby="inheritance-policy-title">
                <h3 id="inheritance-policy-title">{title || t("servers.inheritancePolicy.title", "Apply inheritance")}</h3>
                <p>{description || t("servers.inheritancePolicy.description", "Choose how existing objects should handle these inherited settings.")}</p>
                {impact?.entryCount > 0 && <p className="inheritance-policy-impact">
                    {t("servers.inheritancePolicy.impact", "{{count}} existing objects are affected.", { count: impact.entryCount })}
                </p>}
                <div className="inheritance-policy-options" role="radiogroup">
                    <button type="button" className={policy === "retain" ? "selected" : ""} role="radio" aria-checked={policy === "retain"} onClick={() => setPolicy("retain")}>
                        <strong>{t("servers.inheritancePolicy.retain.title", "Retain existing")}</strong>
                        <span>{t("servers.inheritancePolicy.retain.description", "Keep current values as overrides.")}</span>
                    </button>
                    <button type="button" className={policy === "adopt" ? "selected" : ""} role="radio" aria-checked={policy === "adopt"} onClick={() => setPolicy("adopt")}>
                        <strong>{t("servers.inheritancePolicy.adopt.title", "Adopt folder settings")}</strong>
                        <span>{t("servers.inheritancePolicy.adopt.description", "Replace current values with the inherited folder settings.")}</span>
                    </button>
                </div>
                {impact?.warnings?.map((warning) => <p className="inheritance-policy-warning" key={warning}>{warning}</p>)}
                <div className="inheritance-policy-actions">
                    <Button type="secondary" text={t("common.actions.cancel")} onClick={cancel} />
                    <Button type="primary" text={t("common.actions.confirm")} onClick={confirm} />
                </div>
            </dialog>
        </div>,
        document.body
    );
};

export default InheritancePolicyDialog;
