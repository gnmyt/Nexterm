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
    const [path, setPath] = useState("");
    const [url, setUrl] = useState("");
    const [folder, setFolder] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [share, setShare] = useState("");
    const [domain, setDomain] = useState("");
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
            setPath(provider?.path || "");
            setUrl(provider?.url || "");
            setFolder(provider?.folder || "");
            setUsername(provider?.username || "");
            setPassword("");
            setShare(provider?.share || "");
            setDomain(provider?.domain || "");
        }
    }, [open, provider]);

    const handleSubmit = async () => {
        if (!name) return sendToast(t("common.error"), t("settings.backup.errors.nameRequired"));
        setSaving(true);
        try {
            const data = { name, type, path, url, folder, username, share, domain };
            if (password) data.password = password;
            
            provider
                ? await patchRequest(`backup/providers/${provider.id}`, data)
                : await postRequest("backup/providers", data);
            sendToast(t("common.success"), t(provider ? "settings.backup.providerUpdated" : "settings.backup.providerCreated"));
            onSaved();
        } catch (err) {
            sendToast(t("common.error"), err.message || t("settings.backup.errors.saveFailed"));
        } finally {
            setSaving(false);
        }
    };

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
                            <IconInput icon={mdiFolderOpen} value={path} setValue={setPath} placeholder={t("settings.backup.localPathPlaceholder")} />
                        </div>
                    )}
                    {type === "smb" && (
                        <>
                            <div className="form-group">
                                <label>{t("settings.backup.smbShare")}</label>
                                <IconInput icon={mdiWeb} value={share} setValue={setShare} placeholder={t("settings.backup.smbSharePlaceholder")} />
                            </div>
                            <div className="form-group">
                                <label>{t("settings.backup.smbFolder")}</label>
                                <IconInput icon={mdiFolderOpen} value={folder} setValue={setFolder} placeholder={t("settings.backup.smbFolderPlaceholder")} />
                            </div>
                            <div className="form-group">
                                <label>{t("settings.backup.smbUsername")}</label>
                                <IconInput icon={mdiAccount} value={username} setValue={setUsername} placeholder={t("settings.backup.smbUsernamePlaceholder")} />
                            </div>
                            <div className="form-group">
                                <label>{t("settings.backup.smbPassword")}</label>
                                <IconInput type="password" icon={mdiLock} value={password} setValue={setPassword} placeholder={provider?.hasPassword ? t("settings.backup.passwordUnchanged") : t("settings.backup.smbPasswordPlaceholder")} />
                            </div>
                            <div className="form-group">
                                <label>{t("settings.backup.smbDomain")}</label>
                                <IconInput icon={mdiWeb} value={domain} setValue={setDomain} placeholder={t("settings.backup.smbDomainPlaceholder")} />
                            </div>
                        </>
                    )}
                    {type === "webdav" && (
                        <>
                            <div className="form-group">
                                <label>{t("settings.backup.webdavUrl")}</label>
                                <IconInput icon={mdiWeb} value={url} setValue={setUrl} placeholder={t("settings.backup.webdavUrlPlaceholder")} />
                            </div>
                            <div className="form-group">
                                <label>{t("settings.backup.webdavFolder")}</label>
                                <IconInput icon={mdiFolderOpen} value={folder} setValue={setFolder} placeholder={t("settings.backup.webdavFolderPlaceholder")} />
                            </div>
                            <div className="form-group">
                                <label>{t("settings.backup.webdavUsername")}</label>
                                <IconInput icon={mdiAccount} value={username} setValue={setUsername} placeholder={t("settings.backup.webdavUsernamePlaceholder")} />
                            </div>
                            <div className="form-group">
                                <label>{t("settings.backup.webdavPassword")}</label>
                                <IconInput type="password" icon={mdiLock} value={password} setValue={setPassword} placeholder={provider?.hasPassword ? t("settings.backup.passwordUnchanged") : t("settings.backup.webdavPasswordPlaceholder")} />
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