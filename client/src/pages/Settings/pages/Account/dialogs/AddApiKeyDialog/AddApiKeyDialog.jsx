import { DialogProvider } from "@/common/components/Dialog";
import IconInput from "@/common/components/IconInput";
import { mdiKeyVariant, mdiContentCopy, mdiCheck } from "@mdi/js";
import Button from "@/common/components/Button";
import SelectBox from "@/common/components/SelectBox";
import Icon from "@mdi/react";
import "./styles.sass";
import { postRequest } from "@/common/utils/RequestUtil.js";
import { useState, useEffect } from "react";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { useTranslation } from "react-i18next";

export const AddApiKeyDialog = ({ open, onClose, onCreated }) => {
    const { t } = useTranslation();
    const { sendToast } = useToast();

    const [name, setName] = useState("");
    const [expiry, setExpiry] = useState("never");
    const [error, setError] = useState("");
    const [createdToken, setCreatedToken] = useState(null);
    const [copied, setCopied] = useState(false);

    const expiryOptions = [
        { label: t("settings.account.apiKeys.expiryNever"), value: "never" },
        { label: t("settings.account.apiKeys.expiry30"), value: "30" },
        { label: t("settings.account.apiKeys.expiry90"), value: "90" },
        { label: t("settings.account.apiKeys.expiry365"), value: "365" },
    ];

    useEffect(() => {
        if (open) {
            setName("");
            setExpiry("never");
            setError("");
            setCreatedToken(null);
            setCopied(false);
        }
    }, [open]);

    const create = async () => {
        if (!name.trim()) return setError(t("settings.account.apiKeys.nameRequired"));

        let expiresAt = null;
        if (expiry !== "never") {
            const date = new Date();
            date.setDate(date.getDate() + parseInt(expiry, 10));
            expiresAt = date.toISOString();
        }

        try {
            const result = await postRequest("accounts/api-keys", { name: name.trim(), expiresAt });
            setCreatedToken(result.token);
            onCreated?.();
        } catch (err) {
            setError(err.message || t("settings.account.apiKeys.createError"));
        }
    };

    const copyToken = async () => {
        try {
            await navigator.clipboard.writeText(createdToken);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            sendToast(t("common.error"), t("settings.account.apiKeys.copyError"));
        }
    };

    return (
        <DialogProvider open={open} onClose={onClose} isDirty={!createdToken && name !== ""}>
            <div className="add-api-key-dialog" onKeyDown={(e) => !createdToken && e.key === "Enter" && create()}>
                {!createdToken ? (
                    <>
                        <h2>{t("settings.account.apiKeys.createTitle")}</h2>
                        <p>{t("settings.account.apiKeys.createDescription")}</p>
                        {error && <div className="error">{error}</div>}

                        <div className="form-group">
                            <label htmlFor="api-key-name">{t("settings.account.apiKeys.nameLabel")}</label>
                            <IconInput id="api-key-name" icon={mdiKeyVariant} autoFocus
                                       placeholder={t("settings.account.apiKeys.namePlaceholder")}
                                       value={name} setValue={setName} />
                        </div>

                        <div className="form-group">
                            <label>{t("settings.account.apiKeys.expiryLabel")}</label>
                            <SelectBox options={expiryOptions} selected={expiry} setSelected={setExpiry} />
                        </div>

                        <div className="btn-area">
                            <Button text={t("common.actions.cancel")} type="secondary" onClick={onClose} />
                            <Button text={t("settings.account.apiKeys.createButton")} onClick={create} />
                        </div>
                    </>
                ) : (
                    <>
                        <h2>{t("settings.account.apiKeys.createdTitle")}</h2>
                        <p>{t("settings.account.apiKeys.createdWarning")}</p>

                        <div className="form-group">
                            <label>{t("settings.account.apiKeys.tokenLabel")}</label>
                            <button type="button" className="token-box" onClick={copyToken}>
                                <code>{createdToken}</code>
                                <Icon path={copied ? mdiCheck : mdiContentCopy} size={0.8} />
                            </button>
                        </div>

                        <div className="btn-area">
                            <Button text={t("settings.account.apiKeys.doneButton")} onClick={onClose} />
                        </div>
                    </>
                )}
            </div>
        </DialogProvider>
    );
};
