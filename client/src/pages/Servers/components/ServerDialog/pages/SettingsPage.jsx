import { useEffect, useState } from "react";
import SelectBox from "@/common/components/SelectBox";
import ToggleSwitch from "@/common/components/ToggleSwitch";

const KEYBOARD_LAYOUTS = [
    { label: "Dänisch (Qwerty)", value: "da-dk-qwerty" },
    { label: "Swiss German (Qwertz)", value: "de-ch-qwertz" },
    { label: "Deutsch (Qwertz)", value: "de-de-qwertz" },
    { label: "English (GB) (Qwerty)", value: "en-gb-qwerty" },
    { label: "English (US) (Qwerty)", value: "en-us-qwerty" },
    { label: "Spanisch (Qwerty)", value: "es-es-qwerty" },
    { label: "Latin American (Qwerty)", value: "es-latam-qwerty" },
    { label: "Unicode", value: "failsafe" },
    { label: "Belgian French (Azerty)", value: "fr-be-azerty" },
    { label: "Schweiz/Französisch (Qwertz)", value: "fr-ch-qwertz" },
    { label: "Französisch (Azerty)", value: "fr-fr-azerty" },
    { label: "Hungarian (Qwertz)", value: "hu-hu-qwertz" },
    { label: "Italienisch (Qwerty)", value: "it-it-qwerty" },
    { label: "Japanisch (Qwerty)", value: "ja-jp-qwerty" },
    { label: "Portugiesisch (BR) (Qwerty)", value: "pt-br-qwerty" },
    { label: "Schwedisch (Qwerty)", value: "sv-se-qwerty" },
    { label: "Türkisch (Qwerty)", value: "tr-tr-qwerty" }
];

const SettingsPage = ({ config, setConfig, monitoringEnabled, setMonitoringEnabled, fieldConfig }) => {
    const [keyboardLayout, setKeyboardLayout] = useState(config?.keyboardLayout || "en-us-qwerty");

    const handleKeyboardLayoutChange = (newLayout) => {
        setKeyboardLayout(newLayout);
        setConfig(prev => ({ ...prev, keyboardLayout: newLayout }));
    };

    useEffect(() => {
        if (config?.keyboardLayout && config.keyboardLayout !== keyboardLayout) {
            setKeyboardLayout(config.keyboardLayout);
        }
    }, [config?.keyboardLayout]);

    if (!fieldConfig.showMonitoring && !fieldConfig.showKeyboardLayout) {
        return <p className="text-center">No additional settings available for this entry type.</p>;
    }

    return (
        <>
            {fieldConfig.showMonitoring && (
                <div className="monitoring-toggle-container">
                    <div className="monitoring-toggle-info">
                        <span className="monitoring-label">Enable Performance Monitoring</span>
                        <span className="monitoring-description">
                            Collect CPU, memory, disk, and network metrics for this server
                        </span>
                    </div>
                    <ToggleSwitch checked={monitoringEnabled} onChange={setMonitoringEnabled} id="monitoring-toggle" />
                </div>
            )}

            {fieldConfig.showKeyboardLayout && (
                <div className="keyboard-layout-card">
                    <div className="form-group">
                        <label>Keyboard Layout</label>
                        <SelectBox options={KEYBOARD_LAYOUTS} selected={keyboardLayout} setSelected={handleKeyboardLayoutChange} />
                        <p className="keyboard-layout-description">Select the keyboard layout to use for this connection.</p>
                    </div>
                </div>
            )}
        </>
    );
};

export default SettingsPage;