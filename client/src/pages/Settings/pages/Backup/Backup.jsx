import "./styles.sass";
import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { getRequest, patchRequest, postRequest, deleteRequest, downloadFile } from "@/common/utils/RequestUtil.js";
import { formatBytes, formatDate } from "@/common/utils/formatUtils.js";
import Button from "@/common/components/Button";
import Chip from "@/common/components/Chip";
import SelectBox from "@/common/components/SelectBox";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import ActionConfirmDialog from "@/common/components/ActionConfirmDialog";
import Icon from "@mdi/react";
import {
    mdiPlus, mdiDatabase, mdiVideo, mdiFileDocument, mdiHarddisk, mdiLanConnect,
    mdiCloud, mdiPencil, mdiTrashCan, mdiBackupRestore, mdiCloudUpload, mdiLoading, mdiContentSave, mdiRestore, mdiArchive, mdiDownload, mdiFolderOpen,
} from "@mdi/js";
import ProviderDialog from "./components/ProviderDialog";
import FileBrowserDialog from "./components/FileBrowserDialog";

const StorageCard = ({ icon, title, size, onClick, actionIcon }) => (
    <div className={`storage-card ${onClick ? "clickable" : ""}`} onClick={onClick}>
        <Icon path={icon} className="storage-icon" />
        <div className="storage-info">
            <h4>{title}</h4>
            <span className="storage-size">{formatBytes(size)}</span>
        </div>
        {actionIcon && <Icon path={actionIcon} className="action-icon" />}
    </div>
);

export const Backup = () => {
    const { t } = useTranslation();
    const { sendToast } = useToast();
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState({ scheduleInterval: 0, retention: 5, includeDatabase: true, includeRecordings: false, includeLogs: false, providers: [] });
    const [storage, setStorage] = useState({ database: 0, recordings: 0, logs: 0 });
    const [providerDialogOpen, setProviderDialogOpen] = useState(false);
    const [editProvider, setEditProvider] = useState(null);
    const [expandedProviderId, setExpandedProviderId] = useState(null);
    const [backupsByProvider, setBackupsByProvider] = useState({});
    const [loadingBackups, setLoadingBackups] = useState({});
    const [deleteDialog, setDeleteDialog] = useState({ open: false, provider: null });
    const [restoreDialog, setRestoreDialog] = useState({ open: false, provider: null, backup: null });
    const [creatingBackup, setCreatingBackup] = useState({});
    const [restoring, setRestoring] = useState(null);
    const [fileBrowser, setFileBrowser] = useState({ open: false, type: null });

    const scheduleOptions = [
        { value: 0, label: t("settings.backup.schedule.disabled") },
        { value: 1, label: t("settings.backup.schedule.hourly") },
        { value: 6, label: t("settings.backup.schedule.every6h") },
        { value: 12, label: t("settings.backup.schedule.every12h") },
        { value: 24, label: t("settings.backup.schedule.daily") },
        { value: 168, label: t("settings.backup.schedule.weekly") },
    ];

    const retentionOptions = [1, 3, 5, 10, 20, 50].map(n => ({
        value: n,
        label: `${n} ${t("settings.backup.backups")}`,
    }));

    const loadData = useCallback(async () => {
        try {
            const [settingsData, storageData] = await Promise.all([
                getRequest("backup/settings"),
                getRequest("backup/storage"),
            ]);
            setSettings(settingsData);
            setStorage(storageData);
        } catch {
            sendToast(t("common.error"), t("settings.backup.errors.loadFailed"));
        }
    }, [sendToast, t]);

    useEffect(() => { loadData(); }, [loadData]);

    const fetchBackups = async (providerId) => {
        setLoadingBackups(prev => ({ ...prev, [providerId]: true }));
        try {
            const data = await getRequest(`backup/providers/${providerId}/backups`);
            setBackupsByProvider(prev => ({ ...prev, [providerId]: data }));
        } catch {
            sendToast(t("common.error"), t("settings.backup.errors.loadBackupsFailed"));
        } finally {
            setLoadingBackups(prev => ({ ...prev, [providerId]: false }));
        }
    };

    const handleProviderClick = async (provider) => {
        if (expandedProviderId === provider.id) {
            setExpandedProviderId(null);
        } else {
            setExpandedProviderId(provider.id);
            if (!backupsByProvider[provider.id]) {
                await fetchBackups(provider.id);
            }
        }
    };

    const handleInputChange = useCallback((field, value) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    }, []);

    const saveSettings = async () => {
        try {
            setSaving(true);
            const { providers, ...updateData } = settings;
            const updated = await patchRequest("backup/settings", updateData);
            setSettings(prev => ({ ...prev, ...updated }));
            sendToast(t("common.success"), t("settings.backup.saveSuccess"));
        } catch {
            sendToast(t("common.error"), t("settings.backup.errors.saveFailed"));
        } finally {
            setSaving(false);
        }
    };

    const openAddProvider = () => {
        setEditProvider(null);
        setProviderDialogOpen(true);
    };

    const openEditProvider = (provider, e) => {
        e.stopPropagation();
        setEditProvider(provider);
        setProviderDialogOpen(true);
    };

    const handleProviderSaved = () => {
        setProviderDialogOpen(false);
        loadData();
    };

    const handleDeleteProvider = async () => {
        try {
            await deleteRequest(`backup/providers/${deleteDialog.provider.id}`);
            sendToast(t("common.success"), t("settings.backup.providerDeleted"));
            setExpandedProviderId(null);
            loadData();
        } catch {
            sendToast(t("common.error"), t("settings.backup.errors.deleteFailed"));
        }
        setDeleteDialog({ open: false, provider: null });
    };

    const createBackup = async (provider, e) => {
        e.stopPropagation();
        setCreatingBackup(prev => ({ ...prev, [provider.id]: true }));
        try {
            await postRequest(`backup/providers/${provider.id}/backups`);
            sendToast(t("common.success"), t("settings.backup.backupCreated"));
            await fetchBackups(provider.id);
        } catch {
            sendToast(t("common.error"), t("settings.backup.errors.backupFailed"));
        } finally {
            setCreatingBackup(prev => ({ ...prev, [provider.id]: false }));
        }
    };

    const handleRestore = async () => {
        const { provider, backup } = restoreDialog;
        setRestoreDialog({ open: false, provider: null, backup: null });
        setRestoring(backup.name);
        try {
            await postRequest(`backup/providers/${provider.id}/backups/${encodeURIComponent(backup.name)}/restore`);
            sendToast(t("common.success"), t("settings.backup.restoreStarted"));
        } catch {
            sendToast(t("common.error"), t("settings.backup.errors.restoreFailed"));
            setRestoring(null);
        }
    };

    const getProviderIcon = (type) => {
        switch (type) {
            case "smb": return mdiLanConnect;
            case "webdav": return mdiCloud;
            default: return mdiHarddisk;
        }
    };

    const handleDatabaseExport = () => {
        downloadFile("backup/export/database");
    };

    return (
        <div className="backup-page">
            <div className="settings-section">
                <div className="section-header">
                    <div className="header-content">
                        <h2>{t("settings.backup.storage.title")}</h2>
                        <p>{t("settings.backup.storage.description")}</p>
                    </div>
                </div>
                <div className="storage-grid">
                    <StorageCard icon={mdiDatabase} title={t("settings.backup.storage.database")} size={storage.database} onClick={handleDatabaseExport} actionIcon={mdiDownload} />
                    <StorageCard icon={mdiVideo} title={t("settings.backup.storage.recordings")} size={storage.recordings} onClick={() => setFileBrowser({ open: true, type: "recordings" })} actionIcon={mdiFolderOpen} />
                    <StorageCard icon={mdiFileDocument} title={t("settings.backup.storage.logs")} size={storage.logs} onClick={() => setFileBrowser({ open: true, type: "logs" })} actionIcon={mdiFolderOpen} />
                    <StorageCard icon={mdiHarddisk} title={t("settings.backup.storage.total")} size={storage.database + storage.recordings + storage.logs} />
                </div>
            </div>

            <div className="settings-section">
                <div className="section-header">
                    <div className="header-content">
                        <h2>{t("settings.backup.backupsSection.title")}</h2>
                        <p>{t("settings.backup.backupsSection.description")}</p>
                    </div>
                    <Button text={t("settings.backup.addProvider")} icon={mdiPlus} onClick={openAddProvider} />
                </div>

                <div className="backup-options">
                    <div className="option-group">
                        <label>{t("settings.backup.schedule.title")}</label>
                        <SelectBox options={scheduleOptions} selected={settings.scheduleInterval} setSelected={(v) => handleInputChange("scheduleInterval", v)} />
                    </div>
                    <div className="option-group">
                        <label>{t("settings.backup.retention.title")}</label>
                        <SelectBox options={retentionOptions} selected={settings.retention} setSelected={(v) => handleInputChange("retention", v)} />
                    </div>
                </div>

                <div className="backup-includes">
                    <span className="includes-label">{t("settings.backup.includes.title")}</span>
                    <Chip label={t("settings.backup.includes.database")} selected={settings.includeDatabase} onClick={(v) => handleInputChange("includeDatabase", v)} icon={mdiDatabase} />
                    <Chip label={t("settings.backup.includes.recordings")} selected={settings.includeRecordings} onClick={(v) => handleInputChange("includeRecordings", v)} icon={mdiVideo} />
                    <Chip label={t("settings.backup.includes.logs")} selected={settings.includeLogs} onClick={(v) => handleInputChange("includeLogs", v)} icon={mdiFileDocument} />
                </div>

                <h3>{t("settings.backup.providers")}</h3>

                <div className="vertical-list">
                    {settings.providers.length === 0 ? (
                        <div className="no-providers">
                            <Icon path={mdiBackupRestore} />
                            <h3>{t("settings.backup.noProviders")}</h3>
                            <p>{t("settings.backup.noProvidersDescription")}</p>
                        </div>
                    ) : (
                        settings.providers.map(provider => (
                            <div key={provider.id}>
                                <div className={`item clickable ${expandedProviderId === provider.id ? "expanded" : ""}`} onClick={() => handleProviderClick(provider)}>
                                    <div className="left-section">
                                        <div className="icon primary">
                                            <Icon path={getProviderIcon(provider.type)} />
                                        </div>
                                        <div className="details">
                                            <h3>{provider.name}</h3>
                                            <p>{t(`settings.backup.providerTypes.${provider.type}`)}</p>
                                        </div>
                                    </div>
                                    <div className="right-section">
                                        <Button icon={creatingBackup[provider.id] ? mdiLoading : mdiCloudUpload} onClick={(e) => createBackup(provider, e)} disabled={creatingBackup[provider.id]} type="primary" />
                                        <Button icon={mdiPencil} onClick={(e) => openEditProvider(provider, e)} />
                                        <Button icon={mdiTrashCan} type="danger" onClick={(e) => { e.stopPropagation(); setDeleteDialog({ open: true, provider }); }} />
                                    </div>
                                </div>
                                {expandedProviderId === provider.id && (
                                    <div className="provider-backups">
                                        <h4>{t("settings.backup.backupList", { name: provider.name })}</h4>
                                        {loadingBackups[provider.id] ? (
                                            <div className="backup-loading-inline">
                                                <Icon path={mdiLoading} spin={1} />
                                                <span>{t("settings.backup.loadingBackups")}</span>
                                            </div>
                                        ) : !backupsByProvider[provider.id]?.length ? (
                                            <div className="no-backups-inline">
                                                <Icon path={mdiBackupRestore} />
                                                <span>{t("settings.backup.noBackups")}</span>
                                            </div>
                                        ) : (
                                            <div className="backup-list">
                                                {backupsByProvider[provider.id].map(backup => (
                                                    <div key={backup.name} className="backup-item">
                                                        <div className="backup-left">
                                                            <div className="backup-icon">
                                                                <Icon path={mdiArchive} />
                                                            </div>
                                                            <div className="backup-info">
                                                                <span className="backup-name">{backup.name}</span>
                                                                <span className="backup-meta">{formatBytes(backup.size)} • {formatDate(backup.created)}</span>
                                                            </div>
                                                        </div>
                                                        <Button
                                                            icon={restoring === backup.name ? mdiLoading : mdiRestore}
                                                            onClick={() => setRestoreDialog({ open: true, provider, backup })}
                                                            disabled={restoring === backup.name}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="settings-actions">
                <Button text={t("settings.backup.saveSettings")} icon={mdiContentSave} onClick={saveSettings} disabled={saving} type="primary" />
            </div>

            <ProviderDialog open={providerDialogOpen} onClose={() => setProviderDialogOpen(false)} provider={editProvider} onSaved={handleProviderSaved} />
            <FileBrowserDialog open={fileBrowser.open} onClose={() => setFileBrowser({ open: false, type: null })} type={fileBrowser.type} onFilesChanged={loadData} />
            <ActionConfirmDialog open={deleteDialog.open} setOpen={(open) => setDeleteDialog(prev => ({ ...prev, open }))} onConfirm={handleDeleteProvider} text={t("settings.backup.deleteProviderConfirm", { name: deleteDialog.provider?.name })} />
            <ActionConfirmDialog open={restoreDialog.open} setOpen={(open) => setRestoreDialog(prev => ({ ...prev, open }))} onConfirm={handleRestore} text={t("settings.backup.restoreConfirm", { name: restoreDialog.backup?.name })} />
        </div>
    );
};

export default Backup;
