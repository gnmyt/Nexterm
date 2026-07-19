import { useEffect, useState } from "react";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { getRequest, patchRequest } from "@/common/utils/RequestUtil.js";
import { mdiContentSave } from "@mdi/js";
import Button from "@/common/components/Button";
import ToggleSwitch from "@/common/components/ToggleSwitch";
import { useTranslation } from "react-i18next";
import "./styles.sass";

export const OrganizationSessionSettings = ({ organizationId, canManage }) => {
    const { t } = useTranslation();
    const { sendToast } = useToast();
    const [settings, setSettings] = useState(null);

    useEffect(() => {
        if (!organizationId) return;

        getRequest(`organizations/${organizationId}/session-settings`)
            .then(setSettings)
            .catch(() => {});
    }, [organizationId]);

    const saveSettings = async () => {
        try {
            await patchRequest(`organizations/${organizationId}/session-settings`, settings);
            sendToast(t("common.success"), t("settings.organizations.sessionSettings.messages.updated"));
        } catch (error) {
            sendToast(t("common.error"), t("settings.organizations.sessionSettings.messages.updateFailed"));
        }
    };

    if (!settings) return <></>;

    return (
        <div className="organization-session-settings">
            <div className="settings-content">
                <div className="setting-section">
                    <div className="section-header">
                        <h4>{t("settings.organizations.sessionSettings.liveSharingHeading")}</h4>
                        <p>{t("settings.organizations.sessionSettings.liveSharingDescription")}</p>
                    </div>

                    <div className="settings-list">
                        <div className="setting-item">
                            <div className="setting-info">
                                <span className="setting-label">{t("settings.organizations.sessionSettings.enableLiveSessionSharingLabel")}</span>
                                <span className="setting-description">
                                    {t("settings.organizations.sessionSettings.enableLiveSessionSharingDescription")}
                                </span>
                            </div>
                            <ToggleSwitch
                                id="enableLiveSessionSharing"
                                checked={settings.enableLiveSessionSharing === true}
                                onChange={(value) => setSettings(prev => ({ ...prev, enableLiveSessionSharing: value }))}
                                disabled={!canManage}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {canManage && (
                <div className="settings-actions">
                    <Button text={t("settings.organizations.sessionSettings.actions.save")} icon={mdiContentSave}
                            onClick={saveSettings} />
                </div>
            )}
        </div>
    );
};