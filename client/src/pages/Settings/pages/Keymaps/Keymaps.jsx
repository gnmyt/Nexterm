import "./styles.sass";
import { useKeymaps } from "@/common/contexts/KeymapContext.jsx";
import { useEffect, useState } from "react";
import Button from "@/common/components/Button";
import { mdiRestore, mdiMagnify, mdiRobotOutline, mdiCodeArray, mdiKeyboard, mdiBroadcast, mdiContentCopy, mdiFullscreen, mdiFlash } from "@mdi/js";
import Icon from "@mdi/react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/common/contexts/ToastContext.jsx";

const KEYMAP_ICONS = {
    "search": mdiMagnify,
    "quick-action": mdiFlash,
    "ai-menu": mdiRobotOutline,
    "snippets": mdiCodeArray,
    "keyboard-shortcuts": mdiKeyboard,
    "broadcast": mdiBroadcast,
    "copy": mdiContentCopy,
    "fullscreen": mdiFullscreen,
};

const KeybindRecorder = ({ action, currentKey, onUpdate, onReset }) => {
    const [recording, setRecording] = useState(false);
    const [recordedKey, setRecordedKey] = useState("");
    const { formatKey } = useKeymaps();
    const { t } = useTranslation();

    useEffect(() => {
        if (!recording) return;

        const handleKeyDown = (e) => {
            e.preventDefault();
            e.stopPropagation();

            const parts = [];
            if (e.ctrlKey) parts.push("ctrl");
            if (e.shiftKey) parts.push("shift");
            if (e.altKey) parts.push("alt");
            if (e.metaKey) parts.push("meta");

            const key = e.key.toLowerCase();
            if (!["control", "shift", "alt", "meta"].includes(key)) {
                parts.push(key);
            }

            if (parts.length > 0 && parts[parts.length - 1] !== "ctrl" && parts[parts.length - 1] !== "shift" && parts[parts.length - 1] !== "alt" && parts[parts.length - 1] !== "meta") {
                const combination = parts.join("+");
                setRecordedKey(combination);
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [recording]);

    const startRecording = () => {
        setRecording(true);
        setRecordedKey("");
    };

    const cancelRecording = () => {
        setRecording(false);
        setRecordedKey("");
    };

    const saveRecording = () => {
        if (recordedKey) {
            onUpdate(action, recordedKey);
            setRecording(false);
            setRecordedKey("");
        }
    };

    return (
        <div className="keybind-recorder">
            <div className="keybind-display" onClick={recording ? undefined : startRecording}>
                {recording ? (
                    <span className="recording-text">{recordedKey ? formatKey(recordedKey) : t("settings.keymaps.recorder.pressKeys")}</span>
                ) : (
                    <span className="current-key">{formatKey(currentKey)}</span>
                )}
            </div>
            <div className="keybind-actions">
                {recording ? (
                    <>
                        <Button text={t("settings.keymaps.recorder.save")} onClick={saveRecording} disabled={!recordedKey} />
                        <Button text={t("settings.keymaps.recorder.cancel")} onClick={cancelRecording} />
                    </>
                ) : (
                    <Button text={t("settings.keymaps.recorder.reset")} icon={mdiRestore} onClick={() => onReset(action)} />
                )}
            </div>
        </div>
    );
};

export const Keymaps = () => {
    const { t } = useTranslation();
    const { keymaps, loading, updateKeymap, resetKeymap, resetAllKeymaps } = useKeymaps();
    const { sendToast } = useToast();

    const handleUpdate = async (action, key) => {
        try {
            await updateKeymap(action, { key });
            sendToast("Success", t("settings.keymaps.messages.updateSuccess"));
        } catch (error) {
            sendToast("Error", error.message || t("settings.keymaps.messages.updateFailed"));
        }
    };

    const handleReset = async (action) => {
        try {
            await resetKeymap(action);
            sendToast("Success", t("settings.keymaps.messages.resetSuccess"));
        } catch (error) {
            sendToast("Error", error.message || t("settings.keymaps.messages.resetFailed"));
        }
    };

    const handleResetAll = async () => {
        try {
            await resetAllKeymaps();
            sendToast("Success", t("settings.keymaps.messages.resetAllSuccess"));
        } catch (error) {
            sendToast("Error", error.message || t("settings.keymaps.messages.resetAllFailed"));
        }
    };

    if (loading) {
        return <div className="keymaps-page loading">{t("common.loading")}</div>;
    }

    return (
        <div className="keymaps-page">
            <div className="keymaps-header">
                <div className="header-text">
                    <h2>{t("settings.keymaps.title")}</h2>
                    <p>{t("settings.keymaps.description")}</p>
                </div>
                <Button text={t("settings.keymaps.resetAll")} icon={mdiRestore} onClick={handleResetAll} />
            </div>

            <div className="vertical-list">
                {keymaps.map((keymap) => {
                    const actionKey = keymap.action.replace(/-/g, "");
                    const icon = KEYMAP_ICONS[keymap.action] || mdiKeyboard;
                    return (
                        <div key={keymap.action} className="item">
                            <div className="left-section">
                                <div className="icon primary">
                                    <Icon path={icon} />
                                </div>
                                <div className="details">
                                    <h3>{t(`settings.keymaps.actions.${actionKey}.title`)}</h3>
                                    <p>{t(`settings.keymaps.actions.${actionKey}.description`)}</p>
                                </div>
                            </div>
                            <div className="right-section">
                                <KeybindRecorder
                                    action={keymap.action}
                                    currentKey={keymap.key}
                                    onUpdate={handleUpdate}
                                    onReset={handleReset}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
