import "./styles.sass";
import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { getRequest, patchRequest } from "@/common/utils/RequestUtil.js";
import Button from "@/common/components/Button";
import ToggleSwitch from "@/common/components/ToggleSwitch";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { mdiContentSave } from "@mdi/js";

const NumberInput = ({ value, onChange, min, max, unit }) => (
    <div className="setting-input number-input">
        <input type="number" min={min} max={max} value={value} onChange={(e) => onChange(parseInt(e.target.value, 10) || min)} />
        <span className="unit">{unit}</span>
    </div>
);

const SettingItem = ({ title, description, children }) => (
    <div className="setting-item">
        <div className="setting-label"><h4>{title}</h4><p>{description}</p></div>
        {children}
    </div>
);

export const Monitoring = () => {
    const { t } = useTranslation();
    const { sendToast } = useToast();
    const [settings, setSettings] = useState({ statusCheckerEnabled: true, statusInterval: 30, monitoringEnabled: true, monitoringInterval: 60, dataRetentionHours: 24, connectionTimeout: 30, batchSize: 10 });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const r = await getRequest("monitoring/settings/global");
            setSettings({ ...r, statusCheckerEnabled: Boolean(r.statusCheckerEnabled), monitoringEnabled: Boolean(r.monitoringEnabled) });
        } catch { sendToast(t("common.error"), t("settings.monitoring.errors.loadSettings")); }
        finally { setLoading(false); }
    };

    const saveSettings = async () => {
        try {
            setSaving(true);
            const { id, createdAt, updatedAt, ...data } = settings;
            await patchRequest("monitoring/settings/global", data);
            sendToast(t("common.success"), t("settings.monitoring.saveSuccess"));
        } catch { sendToast(t("common.error"), t("settings.monitoring.errors.saveSettings")); }
        finally { setSaving(false); }
    };

    const set = useCallback((field, value) => setSettings(prev => ({ ...prev, [field]: value })), []);
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    useEffect(() => { loadSettings(); }, []);

    if (loading) return <div className="monitoring-settings-loading">{t("settings.monitoring.loading")}</div>;

    const s = (key) => t(`settings.monitoring.${key}`);

    return (
        <div className="monitoring-settings">
            <div className="settings-section">
                <h2>{s("statusChecker.title")}</h2>
                <p>{s("statusChecker.description")}</p>
                <SettingItem title={s("statusChecker.enable.title")} description={s("statusChecker.enable.description")}>
                    <ToggleSwitch onChange={(v) => set("statusCheckerEnabled", v)} id="status-checker" checked={settings.statusCheckerEnabled} />
                </SettingItem>
                {settings.statusCheckerEnabled && (
                    <SettingItem title={s("statusChecker.interval.title")} description={s("statusChecker.interval.description")}>
                        <NumberInput value={settings.statusInterval} onChange={(v) => set("statusInterval", clamp(v, 10, 300))} min={10} max={300} unit={s("seconds")} />
                    </SettingItem>
                )}
            </div>

            <div className="settings-section">
                <h2>{s("dataCollection.title")}</h2>
                <p>{s("dataCollection.description")}</p>
                <SettingItem title={s("dataCollection.enable.title")} description={s("dataCollection.enable.description")}>
                    <ToggleSwitch onChange={(v) => set("monitoringEnabled", v)} id="monitoring" checked={settings.monitoringEnabled} />
                </SettingItem>
                {settings.monitoringEnabled && (<>
                    <SettingItem title={s("dataCollection.interval.title")} description={s("dataCollection.interval.description")}>
                        <NumberInput value={settings.monitoringInterval} onChange={(v) => set("monitoringInterval", clamp(v, 30, 600))} min={30} max={600} unit={s("seconds")} />
                    </SettingItem>
                    <SettingItem title={s("dataCollection.retention.title")} description={s("dataCollection.retention.description")}>
                        <NumberInput value={settings.dataRetentionHours} onChange={(v) => set("dataRetentionHours", clamp(v, 1, 24))} min={1} max={24} unit={s("hours")} />
                    </SettingItem>
                </>)}
            </div>

            <div className="settings-section">
                <h2>{s("advanced.title")}</h2>
                <p>{s("advanced.description")}</p>
                <SettingItem title={s("advanced.timeout.title")} description={s("advanced.timeout.description")}>
                    <NumberInput value={settings.connectionTimeout} onChange={(v) => set("connectionTimeout", clamp(v, 5, 120))} min={5} max={120} unit={s("seconds")} />
                </SettingItem>
                <SettingItem title={s("advanced.batchSize.title")} description={s("advanced.batchSize.description")}>
                    <NumberInput value={settings.batchSize} onChange={(v) => set("batchSize", clamp(v, 1, 50))} min={1} max={50} unit={s("servers")} />
                </SettingItem>
            </div>

            <div className="settings-actions">
                <Button text={s("saveSettings")} icon={mdiContentSave} onClick={saveSettings} disabled={saving} type="primary" />
            </div>
        </div>
    );
};
