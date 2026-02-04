import { useState, useEffect } from "react";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { getRequest, patchRequest } from "@/common/utils/RequestUtil.js";
import { mdiContentSave } from "@mdi/js";
import Button from "@/common/components/Button";
import ToggleSwitch from "@/common/components/ToggleSwitch";
import { useTranslation } from "react-i18next";
import "./styles.sass";

export const OrganizationAuditSettings = ({ organizationId, isOwner, onClose }) => {
    const { t } = useTranslation();
    const { sendToast } = useToast();
    const [settings, setSettings] = useState(null);

    useEffect(() => {
        if (organizationId) {
            fetchAuditSettings();
        }
    }, [organizationId]);

    const fetchAuditSettings = async () => {
        try {
            const response = await getRequest(`audit/organizations/${organizationId}/settings`);
            setSettings(response);
        } catch (error) {
        }
    };

    const handleSettingChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleRetentionChange = (e) => {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value) && value >= 1 && value <= 365) {
            setSettings(prev => ({ ...prev, recordingRetentionDays: value }));
        }
    };

    const saveSettings = async () => {
        try {
            await patchRequest(`audit/organizations/${organizationId}/settings`, settings);
            sendToast(t("common.success"), t("settings.organizations.auditSettings.messages.updated"));
            if (onClose) onClose();
        } catch (error) {
            sendToast(t("common.error"), t("settings.organizations.auditSettings.messages.updateFailed"));
        }
    };

    if (!settings) return <></>;

    return (
        <div className="organization-audit-settings">
            <div className="settings-content">
                <div className="setting-section">
                    <div className="section-header">
                        <h4>{t("settings.organizations.auditSettings.sessionRecordingHeading")}</h4>
                        <p>{t("settings.organizations.auditSettings.sessionRecordingDescription")}</p>
                    </div>

                    <div className="settings-list">
                        <div className="setting-item">
                            <div className="setting-info">
                                <span className="setting-label">{t("settings.organizations.auditSettings.enableSessionRecordingLabel")}</span>
                                <span className="setting-description">
                                    {t("settings.organizations.auditSettings.enableSessionRecordingDescription")}
                                </span>
                            </div>
                            <ToggleSwitch
                                id="enableSessionRecording"
                                checked={settings.enableSessionRecording !== false}
                                onChange={(value) => handleSettingChange("enableSessionRecording", value)}
                                disabled={!isOwner}
                            />
                        </div>

                        <div className="setting-item">
                            <div className="setting-info">
                                <span className="setting-label">{t("settings.organizations.auditSettings.recordingRetentionLabel")}</span>
                                <span className="setting-description">
                                    {t("settings.organizations.auditSettings.recordingRetentionDescription")}
                                </span>
                            </div>
                            <input
                                type="number"
                                className="retention-input"
                                value={settings.recordingRetentionDays || 90}
                                onChange={handleRetentionChange}
                                min="1"
                                max="365"
                                disabled={!isOwner || settings.enableSessionRecording === false}
                            />
                        </div>
                    </div>
                </div>

                <div className="setting-section">
                    <div className="section-header">
                        <h4>{t("settings.organizations.auditSettings.connectionRequirementsHeading")}</h4>
                        <p>{t("settings.organizations.auditSettings.connectionRequirementsDescription")}</p>
                    </div>

                    <div className="settings-list">
                        <div className="setting-item">
                            <div className="setting-info">
                                <span className="setting-label">{t("settings.organizations.auditSettings.requireConnectionReasonLabel")}</span>
                                <span className="setting-description">
                                    {t("settings.organizations.auditSettings.requireConnectionReasonDescription")}
                                </span>
                            </div>
                            <ToggleSwitch
                                id="requireConnectionReason"
                                checked={settings.requireConnectionReason}
                                onChange={(value) => handleSettingChange("requireConnectionReason", value)}
                                disabled={!isOwner}
                            />
                        </div>
                    </div>
                </div>

                <div className="setting-section">
                    <div className="section-header">
                        <h4>{t("settings.organizations.auditSettings.activityLoggingHeading")}</h4>
                        <p>{t("settings.organizations.auditSettings.activityLoggingDescription")}</p>
                    </div>

                    <div className="settings-list">
                        <div className="setting-item">
                            <div className="setting-info">
                                <span className="setting-label">{t("settings.organizations.auditSettings.fileOperationsLabel")}</span>
                                <span className="setting-description">
                                    {t("settings.organizations.auditSettings.fileOperationsDescription")}
                                </span>
                            </div>
                            <ToggleSwitch
                                id="enableFileOperationAudit"
                                checked={settings.enableFileOperationAudit}
                                onChange={(value) => handleSettingChange("enableFileOperationAudit", value)}
                                disabled={!isOwner}
                            />
                        </div>

                        <div className="setting-item">
                            <div className="setting-info">
                                <span className="setting-label">{t("settings.organizations.auditSettings.serverConnectionsLabel")}</span>
                                <span className="setting-description">
                                    {t("settings.organizations.auditSettings.serverConnectionsDescription")}
                                </span>
                            </div>
                            <ToggleSwitch
                                id="enableServerConnectionAudit"
                                checked={settings.enableServerConnectionAudit}
                                onChange={(value) => handleSettingChange("enableServerConnectionAudit", value)}
                                disabled={!isOwner}
                            />
                        </div>

                        <div className="setting-item">
                            <div className="setting-info">
                                <span className="setting-label">{t("settings.organizations.auditSettings.identityManagementLabel")}</span>
                                <span className="setting-description">
                                    {t("settings.organizations.auditSettings.identityManagementDescription")}
                                </span>
                            </div>
                            <ToggleSwitch
                                id="enableIdentityManagementAudit"
                                checked={settings.enableIdentityManagementAudit}
                                onChange={(value) => handleSettingChange("enableIdentityManagementAudit", value)}
                                disabled={!isOwner}
                            />
                        </div>

                        <div className="setting-item">
                            <div className="setting-info">
                                <span className="setting-label">{t("settings.organizations.auditSettings.passwordPasteLabel")}</span>
                                <span className="setting-description">
                                    {t("settings.organizations.auditSettings.passwordPasteDescription")}
                                </span>
                            </div>
                            <ToggleSwitch
                                id="enableIdentityCredentialsAccessAudit"
                                checked={settings.enableIdentityCredentialsAccessAudit}
                                onChange={(value) => handleSettingChange("enableIdentityCredentialsAccessAudit", value)}
                                disabled={!isOwner}
                            />
                        </div>

                        <div className="setting-item">
                            <div className="setting-info">
                                <span className="setting-label">{t("settings.organizations.auditSettings.serverManagementLabel")}</span>
                                <span className="setting-description">
                                    {t("settings.organizations.auditSettings.serverManagementDescription")}
                                </span>
                            </div>
                            <ToggleSwitch
                                id="enableServerManagementAudit"
                                checked={settings.enableServerManagementAudit}
                                onChange={(value) => handleSettingChange("enableServerManagementAudit", value)}
                                disabled={!isOwner}
                            />
                        </div>

                        <div className="setting-item">
                            <div className="setting-info">
                                <span className="setting-label">{t("settings.organizations.auditSettings.folderManagementLabel")}</span>
                                <span className="setting-description">
                                    {t("settings.organizations.auditSettings.folderManagementDescription")}
                                </span>
                            </div>
                            <ToggleSwitch
                                id="enableFolderManagementAudit"
                                checked={settings.enableFolderManagementAudit}
                                onChange={(value) => handleSettingChange("enableFolderManagementAudit", value)}
                                disabled={!isOwner}
                            />
                        </div>

                        <div className="setting-item">
                            <div className="setting-info">
                                <span className="setting-label">{t("settings.organizations.auditSettings.scriptExecutionLabel")}</span>
                                <span className="setting-description">
                                    {t("settings.organizations.auditSettings.scriptExecutionDescription")}
                                </span>
                            </div>
                            <ToggleSwitch
                                id="enableScriptExecutionAudit"
                                checked={settings.enableScriptExecutionAudit}
                                onChange={(value) => handleSettingChange("enableScriptExecutionAudit", value)}
                                disabled={!isOwner}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {isOwner && (
                <div className="settings-actions">
                    <Button text={t("settings.organizations.auditSettings.actions.save")} icon={mdiContentSave} onClick={saveSettings} />
                </div>
            )}
        </div>
    );
};
