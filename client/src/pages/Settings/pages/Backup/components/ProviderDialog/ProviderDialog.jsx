import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { DialogProvider } from "@/common/components/Dialog";
import Button from "@/common/components/Button";
import IconInput from "@/common/components/IconInput";
import SelectBox from "@/common/components/SelectBox";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { postRequest, patchRequest } from "@/common/utils/RequestUtil.js";
import { mdiHarddisk, mdiLanConnect, mdiFormTextbox, mdiFolderOpen, mdiAccount, mdiLock, mdiWeb, mdiCloud } from "@mdi/js";

export const ProviderDialog = ({ open, onClose, provider, onSaved }) => {
    const { t } = useTranslation();
    const { sendToast } = useToast();
    const [type, setType] = useState("local");
    const [name, setName] = useState("");
    const [config, setConfig] = useState({});
    const [saving, setSaving] = useState(false);

    const typeOptions = [
        { value: "local", label: t("settings.backup.providerTypes.local"), icon: mdiHarddisk },
        { value: "smb", label: t("settings.backup.providerTypes.smb"), icon: mdiLanConnect },
        { value: "webdav", label: t("settings.backup.providerTypes.webdav"), icon: mdiCloud },
    ];

    useEffect(() => {
        if (open) {
            setType(provider?.type || "local");
            setName(provider?.name || "");
            setConfig(provider?.config || {});
        }
    }, [open, provider]);

    const handleSubmit = async () => {
        if (!name) return sendToast(t("common.error"), t("settings.backup.errors.nameRequired"));
        setSaving(true);
        try {
            provider
                ? await patchRequest(`backup/providers/${provider.id}`, { name, type, config })
                : await postRequest("backup/providers", { name, type, config });
            sendToast(t("common.success"), t(provider ? "settings.backup.providerUpdated" : "settings.backup.providerCreated"));
            onSaved();
        } catch (err) {
            sendToast(t("common.error"), err.message || t("settings.backup.errors.saveFailed"));
        } finally {
            setSaving(false);
        }
    };

    const updateConfig = (key, value) => setConfig(prev => ({ ...prev, [key]: value }));

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="provider-dialog">
                <h2>{t(provider ? "settings.backup.editProvider" : "settings.backup.addProvider")}</h2>
                <div className="dialog-content">
                    <div className="form-group">
                        <label>{t("settings.backup.providerName")}</label>
                        <IconInput icon={mdiFormTextbox} value={name} setValue={setName} placeholder={t("settings.backup.providerNamePlaceholder")} />
                    </div>
                    <div className="form-group">
                        <label>{t("settings.backup.providerType")}</label>
                        <SelectBox options={typeOptions} selected={type} setSelected={setType} />
                    </div>
                    {type === "local" && (
                        <div className="form-group">
                            <label>{t("settings.backup.localPath")}</label>
                            <IconInput icon={mdiFolderOpen} value={config.path || ""} setValue={(v) => updateConfig("path", v)} placeholder={t("settings.backup.localPathPlaceholder")} />
                        </div>
                    )}
                    {type === "smb" && (
                        <>
                            <div className="form-group">
                                <label>{t("settings.backup.smbShare")}</label>
                                <IconInput icon={mdiWeb} value={config.share || ""} setValue={(v) => updateConfig("share", v)} placeholder={t("settings.backup.smbSharePlaceholder")} />
                            </div>
                            <div className="form-group">
                                <label>{t("settings.backup.smbFolder")}</label>
                                <IconInput icon={mdiFolderOpen} value={config.folder || ""} setValue={(v) => updateConfig("folder", v)} placeholder={t("settings.backup.smbFolderPlaceholder")} />
                            </div>
                            <div className="form-group">
                                <label>{t("settings.backup.smbUsername")}</label>
                                <IconInput icon={mdiAccount} value={config.username || ""} setValue={(v) => updateConfig("username", v)} placeholder={t("settings.backup.smbUsernamePlaceholder")} />
                            </div>
                            <div className="form-group">
                                <label>{t("settings.backup.smbPassword")}</label>
                                <IconInput type="password" icon={mdiLock} value={config.password || ""} setValue={(v) => updateConfig("password", v)} placeholder={provider?.config?.hasPassword ? t("settings.backup.passwordUnchanged") : t("settings.backup.smbPasswordPlaceholder")} />
                            </div>
                            <div className="form-group">
                                <label>{t("settings.backup.smbDomain")}</label>
                                <IconInput icon={mdiWeb} value={config.domain || ""} setValue={(v) => updateConfig("domain", v)} placeholder={t("settings.backup.smbDomainPlaceholder")} />
                            </div>
                        </>
                    )}
                    {type === "webdav" && (
                        <>
                            <div className="form-group">
                                <label>{t("settings.backup.webdavUrl")}</label>
                                <IconInput icon={mdiWeb} value={config.url || ""} setValue={(v) => updateConfig("url", v)} placeholder={t("settings.backup.webdavUrlPlaceholder")} />
                            </div>
                            <div className="form-group">
                                <label>{t("settings.backup.webdavFolder")}</label>
                                <IconInput icon={mdiFolderOpen} value={config.folder || ""} setValue={(v) => updateConfig("folder", v)} placeholder={t("settings.backup.webdavFolderPlaceholder")} />
                            </div>
                            <div className="form-group">
                                <label>{t("settings.backup.webdavUsername")}</label>
                                <IconInput icon={mdiAccount} value={config.username || ""} setValue={(v) => updateConfig("username", v)} placeholder={t("settings.backup.webdavUsernamePlaceholder")} />
                            </div>
                            <div className="form-group">
                                <label>{t("settings.backup.webdavPassword")}</label>
                                <IconInput type="password" icon={mdiLock} value={config.password || ""} setValue={(v) => updateConfig("password", v)} placeholder={provider?.config?.hasPassword ? t("settings.backup.passwordUnchanged") : t("settings.backup.webdavPasswordPlaceholder")} />
                            </div>
                        </>
                    )}
                </div>
                <div className="dialog-actions">
                    <Button text={t("common.actions.cancel")} onClick={onClose} type="secondary" />
                    <Button text={t("common.actions.save")} onClick={handleSubmit} type="primary" disabled={saving || !name} />
                </div>
            </div>
        </DialogProvider>
    );
};