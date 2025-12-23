import "./styles.sass";
import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { getRequest, postRequest, patchRequest, deleteRequest } from "@/common/utils/RequestUtil.js";
import Button from "@/common/components/Button";
import { DialogProvider } from "@/common/components/Dialog";
import ToggleSwitch from "@/common/components/ToggleSwitch";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import ActionConfirmDialog from "@/common/components/ActionConfirmDialog";
import Input from "@/common/components/IconInput";
import Icon from "@mdi/react";
import {
    mdiPlus,
    mdiSync,
    mdiPencil,
    mdiTrashCan,
    mdiCloudDownload,
    mdiCodeBraces,
    mdiScriptText,
    mdiCheck,
    mdiClose,
    mdiLoading,
    mdiFormTextbox,
    mdiLink,
} from "@mdi/js";

export const Sources = () => {
    const { t } = useTranslation();
    const [sources, setSources] = useState([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editSource, setEditSource] = useState(null);
    const [formData, setFormData] = useState({ name: "", url: "", enabled: true });
    const [validating, setValidating] = useState(false);
    const [validationResult, setValidationResult] = useState(null);
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState({});
    const [deleteConfirmDialog, setDeleteConfirmDialog] = useState({ open: false, source: null });
    const { sendToast } = useToast();

    const loadSources = useCallback(async () => {
        try {
            const data = await getRequest("sources");
            setSources(data);
        } catch (error) {
            sendToast(t("common.errors.generalError"), t("settings.sources.errors.loadFailed"));
        }
    }, [sendToast, t]);

    useEffect(() => {
        loadSources();
    }, [loadSources]);

    const openCreateDialog = () => {
        setEditSource(null);
        setFormData({ name: "", url: "", enabled: true });
        setValidationResult(null);
        setDialogOpen(true);
    };

    const openEditDialog = (source) => {
        setEditSource(source);
        setFormData({ name: source.name, url: source.url, enabled: source.enabled });
        setValidationResult(null);
        setDialogOpen(true);
    };

    const closeDialog = () => {
        setDialogOpen(false);
        setEditSource(null);
        setFormData({ name: "", url: "", enabled: true });
        setValidationResult(null);
    };

    const validateUrl = async () => {
        if (!formData.url) return;

        setValidating(true);
        setValidationResult(null);

        try {
            const result = await postRequest("sources/validate", { url: formData.url });
            setValidationResult(result);
        } catch (error) {
            setValidationResult({
                valid: false,
                error: error.message || t("settings.sources.errors.validationFailed"),
            });
        } finally {
            setValidating(false);
        }
    };

    const handleSubmit = async () => {
        if (!formData.name || !formData.url) {
            sendToast(t("common.errors.generalError"), t("settings.sources.errors.requiredFields"));
            return;
        }

        setSaving(true);

        try {
            if (editSource) {
                await patchRequest(`sources/${editSource.id}`, formData);
                sendToast(t("settings.sources.messages.updated"), "");
            } else {
                await postRequest("sources", { name: formData.name, url: formData.url });
                sendToast(t("settings.sources.messages.created"), "");
            }
            closeDialog();
            loadSources();
        } catch (error) {
            sendToast(t("common.errors.generalError"), error.message || t("settings.sources.errors.saveFailed"));
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteRequest = (source) => {
        setDeleteConfirmDialog({ open: true, source });
    };

    const handleDeleteConfirm = async () => {
        const source = deleteConfirmDialog.source;
        try {
            await deleteRequest(`sources/${source.id}`);
            sendToast(t("settings.sources.messages.deleted"), "");
            loadSources();
        } catch (error) {
            sendToast(t("common.errors.generalError"), error.message || t("settings.sources.errors.deleteFailed"));
        }
        setDeleteConfirmDialog({ open: false, source: null });
    };

    const handleSync = async (sourceId) => {
        setSyncing(prev => ({ ...prev, [sourceId]: true }));

        try {
            await postRequest(`sources/${sourceId}/sync`);
            sendToast(t("settings.sources.messages.synced"), "");
        } catch (error) {
            sendToast(t("common.errors.generalError"), error.message || t("settings.sources.errors.syncFailed"));
        } finally {
            setSyncing(prev => ({ ...prev, [sourceId]: false }));
            loadSources();
        }
    };

    const getStatusClass = (source) => {
        if (!source.enabled) return "disabled";
        if (!source.lastSyncStatus) return "pending";
        return source.lastSyncStatus;
    };

    const getStatusLabel = (source) => {
        if (!source.enabled) return t("settings.sources.status.disabled");
        if (!source.lastSyncStatus) return t("settings.sources.status.pending");
        if (source.lastSyncStatus === "success") return t("settings.sources.status.success");
        return t("settings.sources.status.error");
    };

    return (
        <div className="sources-page">
            <div className="sources-section">
                <div className="section-header">
                    <div className="header-content">
                        <h2>{t("settings.sources.title")}</h2>
                        <p>{t("settings.sources.description")}</p>
                    </div>
                    <Button text={t("settings.sources.addSource")} icon={mdiPlus} onClick={openCreateDialog} />
                </div>

                <div className="sources-grid">
                    {sources.length === 0 ? (
                        <div className="no-sources">
                            <Icon path={mdiCloudDownload} />
                            <h2>{t("settings.sources.noSources")}</h2>
                            <p>{t("settings.sources.noSourcesDescription")}</p>
                        </div>
                    ) : (
                        sources.map(source => (
                            <div key={source.id} className={`source-card ${!source.enabled ? "disabled" : ""}`}>
                                <div className="source-info">
                                    <Icon path={mdiCloudDownload} className="source-icon" />
                                    <div className="source-details">
                                        <div className="source-header">
                                            <h3>{source.name}</h3>
                                            <span className={`source-status ${getStatusClass(source)}`}>
                                                {getStatusLabel(source)}
                                            </span>
                                        </div>
                                        <p className="source-url">{source.url}</p>
                                        <div className="source-meta">
                                            <span className="meta-item">
                                                <Icon path={mdiCodeBraces} />
                                                {source.snippetCount} {t("settings.sources.snippets")}
                                            </span>
                                            <span className="meta-item">
                                                <Icon path={mdiScriptText} />
                                                {source.scriptCount} {t("settings.sources.scripts")}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="source-actions">
                                    <button
                                        className="action-btn sync-btn"
                                        onClick={() => handleSync(source.id)}
                                        disabled={syncing[source.id] || !source.enabled}
                                        title={t("settings.sources.sync")}
                                    >
                                        <Icon path={syncing[source.id] ? mdiLoading : mdiSync}
                                              spin={syncing[source.id] ? 1 : 0} />
                                    </button>
                                    {!source.isDefault && (
                                        <button
                                            className="action-btn edit-btn"
                                            onClick={() => openEditDialog(source)}
                                            title={t("settings.sources.edit")}
                                        >
                                            <Icon path={mdiPencil} />
                                        </button>
                                    )}
                                    {!source.isDefault && (
                                        <button
                                            className="action-btn delete-btn"
                                            onClick={() => handleDeleteRequest(source)}
                                            title={t("settings.sources.delete")}
                                        >
                                            <Icon path={mdiTrashCan} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <DialogProvider open={dialogOpen} onClose={closeDialog}>
                <div className="source-dialog">
                    <h2>{editSource ? t("settings.sources.dialog.editTitle") : t("settings.sources.dialog.createTitle")}</h2>

                    <div className="form-group">
                        <label>{t("settings.sources.dialog.name")}</label>
                        <Input
                            type="text"
                            icon={mdiFormTextbox}
                            value={formData.name}
                            setValue={(value) => setFormData({ ...formData, name: value })}
                            placeholder={t("settings.sources.dialog.namePlaceholder")}
                        />
                    </div>

                    <div className="form-group">
                        <label>{t("settings.sources.dialog.url")}</label>
                        <Input
                            type="text"
                            icon={mdiLink}
                            value={formData.url}
                            setValue={(value) => {
                                setFormData({ ...formData, url: value });
                                setValidationResult(null);
                            }}
                            onBlur={validateUrl}
                            placeholder={t("settings.sources.dialog.urlPlaceholder")}
                        />
                    </div>

                    {validating && (
                        <div className="validation-result loading">
                            <Icon path={mdiLoading} spin={1} />
                            {t("settings.sources.dialog.validating")}
                        </div>
                    )}

                    {validationResult && !validating && (
                        <div className={`validation-result ${validationResult.valid ? "success" : "error"}`}>
                            <Icon path={validationResult.valid ? mdiCheck : mdiClose} />
                            {validationResult.valid ? (
                                t("settings.sources.dialog.validationSuccess", {
                                    snippets: validationResult.snippetCount,
                                    scripts: validationResult.scriptCount,
                                })
                            ) : (
                                validationResult.error
                            )}
                        </div>
                    )}

                    {editSource && (
                        <div className="toggle-row">
                            <div className="toggle-label">
                                <h4>{t("settings.sources.dialog.enabled")}</h4>
                                <p>{t("settings.sources.dialog.enabledDescription")}</p>
                            </div>
                            <ToggleSwitch
                                checked={formData.enabled}
                                onChange={(checked) => setFormData({ ...formData, enabled: checked })}
                                id="source-enabled"
                            />
                        </div>
                    )}

                    <div className="dialog-actions">
                        <Button
                            text={t("common.actions.cancel")}
                            onClick={closeDialog}
                            type="secondary"
                        />
                        <Button
                            text={editSource ? t("common.actions.save") : t("settings.sources.dialog.create")}
                            onClick={handleSubmit}
                            type="primary"
                            disabled={saving || !formData.name || !formData.url}
                        />
                    </div>
                </div>
            </DialogProvider>

            <ActionConfirmDialog
                open={deleteConfirmDialog.open}
                setOpen={(open) => setDeleteConfirmDialog(prev => ({ ...prev, open }))}
                onConfirm={handleDeleteConfirm}
                text={t("settings.sources.deleteConfirm", { name: deleteConfirmDialog.source?.name })}
            />
        </div>
    );
};
