import "./styles.sass";
import { useEffect, useState, useCallback } from "react";
import { useTranslation, Trans } from "react-i18next";
import { getRequest, putRequest, deleteRequest, postRequest } from "@/common/utils/RequestUtil.js";
import Button from "@/common/components/Button";
import { DialogProvider } from "@/common/components/Dialog";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";
import Input from "@/common/components/IconInput";
import Icon from "@mdi/react";
import {
    mdiPlus,
    mdiTrashCan,
    mdiEngine,
    mdiFormTextbox,
    mdiContentCopy,
    mdiRefresh,
    mdiCircle,
    mdiClose,
    mdiCheck,
    mdiTagOutline,
    mdiIpOutline,
    mdiClockOutline,
} from "@mdi/js";

export const Engines = () => {
    const { t } = useTranslation();
    const [engines, setEngines] = useState([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [engineName, setEngineName] = useState("");
    const [saving, setSaving] = useState(false);
    const [deleteConfirmDialog, setDeleteConfirmDialog] = useState({ open: false, engine: null });
    const [tokenBanner, setTokenBanner] = useState(null);
    const [copied, setCopied] = useState(false);
    const { sendToast } = useToast();

    const loadEngines = useCallback(async () => {
        try {
            const data = await getRequest("engines");
            setEngines(data);
        } catch (error) {
            sendToast(t("common.errors.generalError"), error.message || t("settings.engines.errors.loadFailed"));
        }
    }, [sendToast, t]);

    useEffect(() => {
        loadEngines();
        const interval = setInterval(loadEngines, 5000);
        return () => clearInterval(interval);
    }, [loadEngines]);

    const openCreateDialog = () => {
        setEngineName("");
        setDialogOpen(true);
    };

    const closeDialog = () => {
        setDialogOpen(false);
        setEngineName("");
    };

    const handleCreate = async () => {
        if (!engineName.trim()) return;

        setSaving(true);
        try {
            const result = await putRequest("engines", { name: engineName.trim() });
            setTokenBanner({ name: result.name, token: result.registrationToken });
            setCopied(false);
            closeDialog();
            loadEngines();
        } catch (error) {
            sendToast(t("common.error"), error.message || t("settings.engines.errors.createFailed"));
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteRequest = (engine) => {
        setDeleteConfirmDialog({ open: true, engine });
    };

    const handleDeleteConfirm = async () => {
        const engine = deleteConfirmDialog.engine;
        try {
            await deleteRequest(`engines/${engine.id}`);
            sendToast(t("common.success"), t("settings.engines.messages.deleted"));
            loadEngines();
        } catch (error) {
            sendToast(t("common.error"), error.message || t("settings.engines.errors.deleteFailed"));
        }
        setDeleteConfirmDialog({ open: false, engine: null });
    };

    const handleRegenerateToken = async (engineId) => {
        try {
            const result = await postRequest(`engines/${engineId}/regenerate-token`);
            setTokenBanner({ name: result.name, token: result.registrationToken });
            setCopied(false);
        } catch (error) {
            sendToast(t("common.error"), error.message || t("settings.engines.errors.regenerateFailed"));
        }
    };

    const copyToken = (token) => {
        navigator.clipboard.writeText(token);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="engines-page">
            {tokenBanner && (
                <div className="token-banner">
                    <button className="action-btn close-btn" onClick={() => setTokenBanner(null)} title={t("settings.engines.dismiss")}>
                        <Icon path={mdiClose} />
                    </button>
                    <p className="token-label"><Trans i18nKey="settings.engines.tokenLabel" values={{ name: tokenBanner.name }} components={{ strong: <strong /> }} /></p>
                    <p className="token-hint"><Trans i18nKey="settings.engines.tokenHint" components={{ code1: <code />, code2: <code /> }} /></p>
                    <div className="token-value">
                        <code>{tokenBanner.token}</code>
                        <button className="action-btn copy-btn" onClick={() => copyToken(tokenBanner.token)} title={t("settings.engines.copyToken")}>
                            <Icon path={copied ? mdiCheck : mdiContentCopy} />
                        </button>
                    </div>
                </div>
            )}

            <div className="engines-section">
                <div className="section-header">
                    <div className="header-content">
                        <h2>{t("settings.engines.title")}</h2>
                        <p>{t("settings.engines.description")}</p>
                    </div>
                    <Button text={t("settings.engines.addEngine")} icon={mdiPlus} onClick={openCreateDialog} />
                </div>

                <div className="engines-grid">
                    {engines.length === 0 ? (
                        <div className="no-engines">
                            <Icon path={mdiEngine} />
                            <h2>{t("settings.engines.noEngines")}</h2>
                            <p>{t("settings.engines.noEnginesDescription")}</p>
                        </div>
                    ) : (
                        engines.map(engine => (
                            <div key={engine.id} className="engine-card">
                                <div className="engine-info">
                                    <Icon path={mdiEngine} className="engine-icon" />
                                    <div className="engine-details">
                                        <div className="engine-name-row">
                                            <h3>{engine.name}</h3>
                                            <span className={`engine-status ${engine.connected ? "connected" : "disconnected"}`}>
                                                <Icon path={mdiCircle} className="status-dot" />
                                                {engine.connected ? t("settings.engines.status.connected") : t("settings.engines.status.disconnected")}
                                            </span>
                                        </div>
                                        <div className="engine-meta">
                                            {engine.connected && engine.version && (
                                                <>
                                                    <span className="meta-item">
                                                        <Icon path={mdiTagOutline} />
                                                        v{engine.version}
                                                    </span>
                                                    <span className="meta-item">
                                                        <Icon path={mdiIpOutline} />
                                                        {engine.remoteAddr}
                                                    </span>
                                                </>
                                            )}
                                            {!engine.connected && engine.lastConnectedAt && (
                                                <span className="meta-item">
                                                    <Icon path={mdiClockOutline} />
                                                    {t("settings.engines.lastSeen", { date: new Date(engine.lastConnectedAt).toLocaleString() })}
                                                </span>
                                            )}
                                            {!engine.connected && !engine.lastConnectedAt && (
                                                <span className="meta-item">
                                                    <Icon path={mdiClockOutline} />
                                                    {t("settings.engines.neverConnected")}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="engine-actions">
                                    <button
                                        className="action-btn refresh-btn"
                                        onClick={() => handleRegenerateToken(engine.id)}
                                        title={t("settings.engines.regenerateToken")}
                                    >
                                        <Icon path={mdiRefresh} />
                                    </button>
                                    <button
                                        className="action-btn delete-btn"
                                        onClick={() => handleDeleteRequest(engine)}
                                        title={t("settings.engines.deleteEngine")}
                                    >
                                        <Icon path={mdiTrashCan} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <DialogProvider open={dialogOpen} onClose={closeDialog}>
                <div className="engine-dialog">
                    <h2>{t("settings.engines.dialog.title")}</h2>
                    <div className="form-group">
                        <label>{t("settings.engines.dialog.engineName")}</label>
                        <Input
                            type="text"
                            icon={mdiFormTextbox}
                            value={engineName}
                            setValue={setEngineName}
                            placeholder={t("settings.engines.dialog.namePlaceholder")}
                        />
                    </div>
                    <div className="dialog-actions">
                        <Button
                            text={t("common.actions.cancel")}
                            onClick={closeDialog}
                            type="secondary"
                        />
                        <Button
                            text={t("settings.engines.dialog.create")}
                            onClick={handleCreate}
                            type="primary"
                            disabled={saving || !engineName.trim()}
                        />
                    </div>
                </div>
            </DialogProvider>

            <ActionConfirmDialog
                open={deleteConfirmDialog.open}
                setOpen={(open) => setDeleteConfirmDialog(prev => ({ ...prev, open }))}
                onConfirm={handleDeleteConfirm}
                text={t("settings.engines.deleteConfirm", { name: deleteConfirmDialog.engine?.name })}
            />
        </div>
    );
};
