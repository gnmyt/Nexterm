import { mdiMonitorDashboard, mdiVolumeHigh } from "@mdi/js";
import { useTranslation } from "react-i18next";
import SelectBox from "@/common/components/SelectBox";
import { PERFORMANCE_TOGGLES } from "../utils/configDefaults.js";
import { AUTO_SCALE, SCALE_STEPS } from "@/common/utils/displayScale.js";
import { SectionBlock, SettingRow } from "@/common/components/SectionedDialog";
import Field from "@/common/components/Field";

const COLOR_DEPTHS = [
    { label: "Auto", value: "" },
    { label: "256 colors (8-bit)", value: "8" },
    { label: "Low color (16-bit)", value: "16" },
    { label: "True color (24-bit)", value: "24" },
    { label: "True color (32-bit)", value: "32" },
];

const RESIZE_METHODS = [
    { label: "Display Update (recommended)", value: "display-update" },
    { label: "Reconnect", value: "reconnect" },
    { label: "None", value: "none" },
];

const CLIPBOARD_ENCODINGS = [
    { label: "Default (ISO-8859-1)", value: "" },
    { label: "UTF-8 (Extended Clipboard / TigerVNC)", value: "UTF-8" },
    { label: "ISO-8859-1", value: "ISO8859-1" },
    { label: "UTF-16", value: "UTF-16" },
    { label: "Windows-1252", value: "CP1252" },
];

const DISPLAY_SCALES = SCALE_STEPS.map(scale => ({ label: `${scale}%`, value: String(scale) }));

const RDP_SECURITY_METHODS = [
    { label: "Auto (negotiate best)", value: "" },
    { label: "Any (highest available)", value: "any" },
    { label: "NLA (Kerberos / CredSSP)", value: "nla" },
    { label: "TLS (SSL)", value: "tls" },
    { label: "RDP (NTLM)", value: "rdp" },
    { label: "Hyper-V (vmconnect)", value: "vmconnect" },
];

const KEYBOARD_LAYOUTS = [
    { label: "Čeština (Qwertz)", value: "cs-cz-qwertz" },
    { label: "Dänish (Qwerty)", value: "da-dk-qwerty" },
    { label: "Swiss German (Qwertz)", value: "de-ch-qwertz" },
    { label: "Deutsch (Qwertz)", value: "de-de-qwertz" },
    { label: "English (GB) (Qwerty)", value: "en-gb-qwerty" },
    { label: "English (US) (Qwerty)", value: "en-us-qwerty" },
    { label: "Spanish (Qwerty)", value: "es-es-qwerty" },
    { label: "Spanish (Latin America) (Qwerty)", value: "es-latam-qwerty" },
    { label: "Unicode", value: "failsafe" },
    { label: "Belgian French (Azerty)", value: "fr-be-azerty" },
    { label: "Schweiz/Französisch (Qwertz)", value: "fr-ch-qwertz" },
    { label: "French (Azerty)", value: "fr-fr-azerty" },
    { label: "Hungarian (Qwertz)", value: "hu-hu-qwertz" },
    { label: "Italian (Qwerty)", value: "it-it-qwerty" },
    { label: "Japanese (Qwerty)", value: "ja-jp-qwerty" },
    { label: "Portuguese-Brazil (BR) (Qwerty)", value: "pt-br-qwerty" },
    { label: "Swedish (Qwerty)", value: "sv-se-qwerty" },
    { label: "Turkish (Qwerty)", value: "tr-tr-qwerty" },
];

export const DisplayFields = ({ config, setConfig, fieldConfig }) => {
    const { t } = useTranslation();
    const update = (patch) => setConfig(prev => ({ ...prev, ...patch }));

    return (
        <>
            {fieldConfig.showKeyboardLayout && (
                <Field configKey="keyboardLayout" label={t("servers.dialog.settings.keyboardLayout.title")} hint={t("servers.dialog.settings.keyboardLayout.description")}>
                    <SelectBox options={KEYBOARD_LAYOUTS} selected={config.keyboardLayout || "en-us-qwerty"}
                               setSelected={(value) => update({ keyboardLayout: value })} searchable />
                </Field>
            )}

            {fieldConfig.showDisplaySettings && (
                <div className="sd-row sd-row--split">
                    <Field label={t("servers.dialog.settings.display.colorDepth")} configKey="colorDepth">
                        <SelectBox options={COLOR_DEPTHS} selected={config.colorDepth || ""}
                                   setSelected={(value) => update({ colorDepth: value })} />
                    </Field>
                    <Field label={t("servers.dialog.settings.display.resizeMethod")} configKey="resizeMethod">
                        <SelectBox options={RESIZE_METHODS} selected={config.resizeMethod || "display-update"}
                                   setSelected={(value) => update({ resizeMethod: value })} />
                    </Field>
                </div>
            )}

            {config.protocol === "vnc" && (
                <Field configKey="clipboardEncoding" label={t("servers.dialog.settings.display.clipboardEncoding")}
                       hint={t("servers.dialog.settings.display.clipboardEncodingHint")}>
                    <SelectBox options={CLIPBOARD_ENCODINGS} selected={config.clipboardEncoding || ""}
                               setSelected={(value) => update({ clipboardEncoding: value })} />
                </Field>
            )}

            {fieldConfig.showDisplayScale && (
                <Field label={t("servers.dialog.settings.display.displayScale")} configKey="displayScale">
                    <SelectBox options={[
                                   { label: t("servers.dialog.settings.display.displayScaleAccount"), value: "" },
                                   { label: t("servers.dialog.settings.display.displayScaleAuto"), value: AUTO_SCALE },
                                   ...DISPLAY_SCALES,
                               ]}
                               selected={config.displayScale || ""}
                               setSelected={(value) => update({ displayScale: value })} />
                </Field>
            )}

            {fieldConfig.showRdpSecurity && (
                <Field configKey="rdpSecurity" label={t("servers.dialog.settings.rdpSecurity.method")} hint={t("servers.dialog.settings.rdpSecurity.description")}>
                    <SelectBox options={RDP_SECURITY_METHODS} selected={config.rdpSecurity || ""}
                               setSelected={(value) => update({ rdpSecurity: value })} />
                </Field>
            )}

            {(fieldConfig.showAudioSettings || fieldConfig.showPerformanceSettings) && (
                <div className="sd-settings">
                    {fieldConfig.showAudioSettings && (
                        <SettingRow id="enable-audio" icon={mdiVolumeHigh} configKey="enableAudio"
                                    label={t("servers.dialog.settings.audio.enableAudio")}
                                    description={t("servers.dialog.settings.audio.enableAudioDesc")}
                                    checked={config.enableAudio !== false}
                                    onChange={(value) => update({ enableAudio: value })} />
                    )}
                    {fieldConfig.showPerformanceSettings && PERFORMANCE_TOGGLES.map(({ key, defaultOn }) => (
                        <SettingRow key={key} id={`perf-${key}`} configKey={key}
                                    label={t(`servers.dialog.settings.performance.${key}`)}
                                    description={t(`servers.dialog.settings.performance.${key}Desc`)}
                                    checked={config[key] === undefined ? defaultOn : config[key] === true}
                                    onChange={(value) => update({ [key]: value })} />
                    ))}
                </div>
            )}
        </>
    );
};

const DisplaySection = (props) => {
    const { t } = useTranslation();
    return (
        <SectionBlock id="display" icon={mdiMonitorDashboard} title={t("servers.dialog.settings.display.title")}
                      description={t("servers.dialog.settings.display.description")}>
            <DisplayFields {...props} />
        </SectionBlock>
    );
};

export default DisplaySection;
