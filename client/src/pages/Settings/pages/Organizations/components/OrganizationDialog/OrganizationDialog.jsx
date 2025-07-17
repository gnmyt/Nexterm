import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { DialogProvider } from "@/common/components/Dialog";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import IconInput from "@/common/components/IconInput";
import { mdiDomain, mdiFormTextbox } from "@mdi/js";
import Button from "@/common/components/Button";
import { putRequest } from "@/common/utils/RequestUtil.js";
import "./styles.sass";

export const OrganizationDialog = ({ open, onClose, refreshOrganizations }) => {
    const { t } = useTranslation();
    const { sendToast } = useToast();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");

    useEffect(() => {
        if (!open) {
            setName("");
            setDescription("");
        }
    }, [open]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!name.trim()) {
            sendToast("Error", t('settings.organizations.dialog.messages.nameRequired'));
            return;
        }

        try {
            await putRequest("organizations", {
                name: name.trim(),
                description: description.trim() || undefined
            });
            
            sendToast("Success", t('settings.organizations.dialog.messages.createSuccess'));
            refreshOrganizations();
            onClose();
        } catch (error) {
            sendToast("Error", error.message || t('settings.organizations.dialog.messages.createFailed'));
        }
    };

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="organization-dialog">
                <h2>{t('settings.organizations.dialog.title')}</h2>
                
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="name">{t('settings.organizations.dialog.fields.name')}</label>
                        <IconInput
                            icon={mdiDomain}
                            id="name"
                            placeholder={t('settings.organizations.dialog.fields.namePlaceholder')}
                            value={name}
                            setValue={setName}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="description">{t('settings.organizations.dialog.fields.description')}</label>
                        <IconInput
                            icon={mdiFormTextbox}
                            id="description"
                            placeholder={t('settings.organizations.dialog.fields.descriptionPlaceholder')}
                            value={description}
                            setValue={setDescription}
                        />
                    </div>

                    <div className="dialog-actions">
                        <Button text={t('settings.organizations.dialog.actions.cancel')} onClick={onClose} type="secondary" buttonType="button" />
                        <Button text={t('settings.organizations.dialog.actions.create')} type="primary" buttonType="submit" />
                    </div>
                </form>
            </div>
        </DialogProvider>
    );
};