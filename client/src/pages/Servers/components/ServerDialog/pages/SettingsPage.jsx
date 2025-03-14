import { useEffect, useState } from "react";
import SelectBox from "@/common/components/SelectBox";

const KEYBOARD_LAYOUTS = [
    { label: "US English (en-us-qwerty)", value: "en-us-qwerty" },
    { label: "English (UK) (en-gb-qwerty)", value: "en-gb-qwerty" },
    { label: "French (fr-fr-azerty)", value: "fr-fr-azerty" },
    { label: "German (de-de-qwertz)", value: "de-de-qwertz" },
    { label: "Italian (it-it-qwerty)", value: "it-it-qwerty" },
    { label: "Japanese (ja-jp-qwerty)", value: "ja-jp-qwerty" },
    { label: "Spanish (es-es-qwerty)", value: "es-es-qwerty" },
    { label: "Portuguese (Brazilian) (pt-br-qwerty)", value: "pt-br-qwerty" },
    { label: "Swiss French (fr-ch-qwertz)", value: "fr-ch-qwertz" },
    { label: "Swiss German (de-ch-qwertz)", value: "de-ch-qwertz" },
];

const SettingsPage = ({ protocol, config, setConfig }) => {
    const [keyboardLayout, setKeyboardLayout] = useState(() => {
        return config?.keyboardLayout || "en-us-qwerty";
    });

    const handleKeyboardLayoutChange = (newLayout) => {
        setKeyboardLayout(newLayout);
        setConfig(prevConfig => ({ ...prevConfig, keyboardLayout: newLayout }));
    };

    useEffect(() => {
        if (config?.keyboardLayout && config.keyboardLayout !== keyboardLayout) setKeyboardLayout(config.keyboardLayout);
    }, [config]);

    return (
        <>
            {(protocol === "vnc" || protocol === "rdp") && (
                <div className="form-group keyboard-layout-group">
                    <label>Keyboard Layout</label>
                    <SelectBox options={KEYBOARD_LAYOUTS} selected={keyboardLayout}
                               setSelected={handleKeyboardLayoutChange} />
                    <p>Select the keyboard layout to use for this connection.</p>
                </div>
            )}

            {protocol !== "vnc" && protocol !== "rdp" && (
                <p>No additional settings available for this protocol.</p>
            )}
        </>
    );
};

export default SettingsPage;