import { useState, useEffect } from "react";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { getRequest, patchRequest } from "@/common/utils/RequestUtil.js";
import { mdiContentSave } from "@mdi/js";
import Button from "@/common/components/Button";
import ToggleSwitch from "@/common/components/ToggleSwitch";
import "./styles.sass";

export const OrganizationAuditSettings = ({ organizationId, isOwner, onClose }) => {
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
        setSettings(prev => ({ ...prev, [key]: value, }));
    };

    const saveSettings = async () => {
        try {
            await patchRequest(`audit/organizations/${organizationId}/settings`, settings);
            sendToast("Success", "Audit settings updated successfully");
            if (onClose) onClose();
        } catch (error) {
            sendToast("Error", "Failed to update audit settings");
        }
    };

    if (!settings) return <></>;

    return (
        <div className="organization-audit-settings">
            <div className="settings-content">
                <div className="setting-section">
                    <div className="section-header">
                        <h4>Connection Requirements</h4>
                        <p>Control connection behavior and requirements</p>
                    </div>

                    <div className="setting-item">
                        <div className="setting-info">
                            <span className="setting-label">Require Connection Reason</span>
                            <span className="setting-description">
                                Require users to provide a reason when connecting to servers in this organization
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

                <div className="setting-section">
                    <div className="section-header">
                        <h4>Activity Logging</h4>
                        <p>Choose which types of activities to log</p>
                    </div>

                    <div className="setting-item">
                        <div className="setting-info">
                            <span className="setting-label">File Operations</span>
                            <span className="setting-description">
                                Log file uploads, downloads, deletions, and renames via SFTP
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
                            <span className="setting-label">Server Connections</span>
                            <span className="setting-description">
                                Log SSH, SFTP, and PVE connections and disconnections
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
                            <span className="setting-label">Identity Management</span>
                            <span className="setting-description">
                                Log creation, modification, and deletion of SSH identities
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
                            <span className="setting-label">Server Management</span>
                            <span className="setting-description">
                                Log creation, modification, and deletion of server configurations
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
                            <span className="setting-label">Folder Management</span>
                            <span className="setting-description">
                                Log creation, modification, and deletion of organization folders
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
                            <span className="setting-label">Script Execution</span>
                            <span className="setting-description">
                                Log execution of scripts and automation tasks on servers
                            </span>
                        </div>
                        <ToggleSwitch
                            id="enableScriptExecutionAudit"
                            checked={settings.enableScriptExecutionAudit}
                            onChange={(value) => handleSettingChange("enableScriptExecutionAudit", value)}
                            disabled={!isOwner}
                        />
                    </div>

                    <div className="setting-item">
                        <div className="setting-info">
                            <span className="setting-label">App Installation</span>
                            <span className="setting-description">
                                Log installation and deployment of applications
                            </span>
                        </div>
                        <ToggleSwitch
                            id="enableAppInstallationAudit"
                            checked={settings.enableAppInstallationAudit}
                            onChange={(value) => handleSettingChange("enableAppInstallationAudit", value)}
                            disabled={!isOwner}
                        />
                    </div>
                </div>
            </div>

            {isOwner && (
                <div className="settings-actions"><Button text="Save Settings" icon={mdiContentSave}
                                                          onClick={saveSettings} />
                </div>
            )}
        </div>
    );
};
