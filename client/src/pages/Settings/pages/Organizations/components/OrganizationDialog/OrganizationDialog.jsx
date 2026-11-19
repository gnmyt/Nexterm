import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { DialogProvider, DialogCancelButton } from "@/common/components/Dialog";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import IconInput from "@/common/components/IconInput";
import { mdiDomain, mdiFormTextbox } from "@mdi/js";
import Button from "@/common/components/Button";
import { patchRequest, putRequest } from "@/common/utils/RequestUtil.js";
import "./styles.sass";

export const OrganizationDialog = ({ open, onClose, refreshOrganizations, organization = null }) => {
    const { t } = useTranslation();
    const { sendToast } = useToast();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");

    const isEdit = !!organization;

    useEffect(() => {
        setName(open ? organization?.name || "" : "");
        setDescription(open ? organization?.description || "" : "");
    }, [open, organization]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!name.trim()) {
            sendToast("Error", t('settings.organizations.dialog.messages.nameRequired'));
            return;
        }

        try {
            if (isEdit) {
                await patchRequest(`organizations/${organization.id}`, {
                    name: name.trim(),
                    description: description.trim(),
                });
            } else {
                await putRequest("organizations", {
                    name: name.trim(),
                    description: description.trim() || undefined
                });
            }

            sendToast("Success", t(`settings.organizations.dialog.messages.${isEdit ? "updateSuccess" : "createSuccess"}`));
            refreshOrganizations();
            onClose();
        } catch (error) {
            sendToast("Error", error.message || t(`settings.organizations.dialog.messages.${isEdit ? "updateFailed" : "createFailed"}`));
        }
    };

    const isDirty = name !== (organization?.name || "") || description !== (organization?.description || "");

    return (
        <DialogProvider open={open} onClose={onClose} isDirty={isDirty}>
            <div className="organization-dialog">
                <h2>{t(`settings.organizations.dialog.${isEdit ? "editTitle" : "title"}`)}</h2>
                
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
                        <DialogCancelButton text={t('settings.organizations.dialog.actions.cancel')} />
                        <Button text={t(`settings.organizations.dialog.actions.${isEdit ? "save" : "create"}`)} type="primary" buttonType="submit" />
                    </div>
                </form>
            </div>
        </DialogProvider>
    );
};