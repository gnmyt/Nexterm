import { DialogProvider } from "@/common/components/Dialog";
import IconInput from "@/common/components/IconInput";
import { mdiKeyVariant } from "@mdi/js";
import Button from "@/common/components/Button";
import "./styles.sass";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

export const AddPasskeyDialog = ({ open, onClose, onSubmit }) => {
    const { t } = useTranslation();

    const [name, setName] = useState("");

    const handleSubmit = () => {
        if (!name.trim()) return;
        onSubmit(name.trim());
        setName("");
    };

    useEffect(() => {
        if (open) {
            setName(t("settings.account.passkeys.defaultName"));
        }
    }, [open, t]);

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="add-passkey-dialog" onKeyDown={e => e.key === "Enter" && handleSubmit()}>
                <h2>{t("settings.account.passkeys.addDialogTitle")}</h2>
                <p>{t("settings.account.passkeys.addDialogDescription")}</p>
                <div className="form-group">
                    <IconInput 
                        icon={mdiKeyVariant} 
                        placeholder={t("settings.account.passkeys.namePlaceholder")}
                        value={name} 
                        setValue={setName} 
                        autoFocus
                    />
                </div>
                <div className="btn-area">
                    <Button text={t("common.actions.cancel")} type="secondary" onClick={onClose} />
                    <Button text={t("settings.account.passkeys.addButton")} onClick={handleSubmit} />
                </div>
            </div>
        </DialogProvider>
    );
};
