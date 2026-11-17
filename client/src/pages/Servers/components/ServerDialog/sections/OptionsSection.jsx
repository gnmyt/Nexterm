import { mdiTuneVariant, mdiChartLine, mdiPowerPlug } from "@mdi/js";
import { useTranslation } from "react-i18next";
import { SectionBlock, SettingRow } from "@/common/components/SectionedDialog";
import ConnectionHooksSection from "../components/ConnectionHooksSection.jsx";

export const OptionsFields = ({ config, setConfig, fieldConfig, monitoringEnabled, setMonitoringEnabled, monitoringLabel, monitoringDescription }) => {
    const { t } = useTranslation();

    return (
        <div className="sd-settings">
            {fieldConfig.showMonitoring && (
                <SettingRow id="monitoring-toggle" icon={mdiChartLine} configKey="monitoringEnabled"
                            label={monitoringLabel || t("servers.dialog.settings.monitoring.title")}
                            description={monitoringDescription || t("servers.dialog.settings.monitoring.description")}
                            checked={monitoringEnabled} onChange={setMonitoringEnabled} />
            )}
            {fieldConfig.showWakeOnLan && (
                <SettingRow id="wake-on-lan-toggle" icon={mdiPowerPlug} configKey="wakeOnLanEnabled"
                            label={t("servers.dialog.settings.wakeOnLan.title")}
                            description={t("servers.dialog.settings.wakeOnLan.description")}
                            checked={config.wakeOnLanEnabled === true}
                            onChange={(value) => setConfig(prev => ({ ...prev, wakeOnLanEnabled: value }))} />
            )}
        </div>
    );
};

const OptionsSection = (props) => {
    const { t } = useTranslation();
    return (
        <SectionBlock id="options" icon={mdiTuneVariant} title={t("servers.dialog.sections.options")}>
            <OptionsFields {...props} />
            {props.fieldConfig.showConnectionHooks && (
                <ConnectionHooksSection config={props.config} setConfig={props.setConfig} />
            )}
        </SectionBlock>
    );
};

export default OptionsSection;
