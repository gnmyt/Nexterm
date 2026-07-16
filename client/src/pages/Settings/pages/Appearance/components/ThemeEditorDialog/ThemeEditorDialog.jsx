import "./styles.sass";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getRequest, putRequest, patchRequest } from "@/common/utils/RequestUtil.js";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { DialogProvider } from "@/common/components/Dialog";
import Button from "@/common/components/Button";
import IconInput from "@/common/components/IconInput";
import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { mdiFormTextbox, mdiTextBoxOutline } from "@mdi/js";

loader.config({ monaco });

const getDefaultCSS = () =>
`:root {
    /* Example: change the accent color */
    /* --accent-color: #E63946; */

    /* Example: change backgrounds */
    /* --background: #1a1a2e; */
    /* --lighter-background: #16213e; */

    /* Example: change text colors */
    /* --text: #eee; */
    /* --subtext: #a0a0a0; */
}

/* You can also override specific component styles */
/* .some-class { property: value; } */
`;

export const ThemeEditorDialog = ({ open, onClose, editTheme, onSaved, actualTheme }) => {
    const { t } = useTranslation();
    const { sendToast } = useToast();

    const [editorName, setEditorName] = useState("");
    const [editorDescription, setEditorDescription] = useState("");
    const [editorCSS, setEditorCSS] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        if (editTheme) {
            const loadTheme = async () => {
                try {
                    const full = await getRequest(`themes/${editTheme.id}`);
                    setEditorName(full.name);
                    setEditorDescription(full.description || "");
                    setEditorCSS(full.css);
                } catch {
                    sendToast(t("common.error"), t("settings.account.customThemes.failedToLoadTheme"));
                    onClose();
                }
            };
            loadTheme();
        } else {
            setEditorName("");
            setEditorDescription("");
            setEditorCSS(getDefaultCSS());
        }
    }, [open, editTheme]);

    const handleSave = async () => {
        if (!editorName.trim() || !editorCSS.trim()) {
            sendToast(t("common.error"), t("settings.account.customThemes.nameAndCssRequired"));
            return;
        }
        setSaving(true);
        try {
            const payload = { name: editorName, css: editorCSS, description: editorDescription };
            if (editTheme) {
                await patchRequest(`themes/${editTheme.id}`, payload);
                sendToast(t("common.success"), t("settings.account.customThemes.themeUpdated"));
            } else {
                await putRequest("themes", payload);
                sendToast(t("common.success"), t("settings.account.customThemes.themeCreated"));
            }
            onClose();
            onSaved();
        } catch (err) {
            sendToast(t("common.error"), err.message || t("settings.account.customThemes.failedToSaveTheme"));
        } finally {
            setSaving(false);
        }
    };

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="theme-editor-dialog">
                <div className="editor-header">
                    <h2>{editTheme ? t("settings.account.customThemes.editTheme") : t("settings.account.customThemes.createTheme")}</h2>
                </div>
                <div className="editor-meta">
                    <div className="form-group">
                        <label>{t("settings.account.customThemes.name")}</label>
                        <IconInput
                            icon={mdiFormTextbox}
                            placeholder={t("settings.account.customThemes.themeName")}
                            value={editorName}
                            setValue={setEditorName}
                        />
                    </div>
                    <div className="form-group">
                        <label>{t("settings.account.customThemes.descriptionLabel")}</label>
                        <IconInput
                            icon={mdiTextBoxOutline}
                            placeholder={t("settings.account.customThemes.optionalDescription")}
                            value={editorDescription}
                            setValue={setEditorDescription}
                        />
                    </div>
                </div>
                <div className="editor-container">
                    <Editor
                        height="350px"
                        language="css"
                        theme={actualTheme === "light" ? "vs" : "vs-dark"}
                        value={editorCSS}
                        onChange={(value) => setEditorCSS(value || "")}
                        options={{
                            minimap: { enabled: false },
                            fontSize: 13,
                            lineNumbers: "on",
                            scrollBeyondLastLine: false,
                            wordWrap: "on",
                            tabSize: 2,
                            automaticLayout: true,
                            padding: { top: 12 },
                        }}
                    />
                </div>
                <div className="editor-actions">
                    <Button text={t("common.cancel")} onClick={onClose} type="secondary" />
                    <Button
                        text={editTheme ? t("settings.account.customThemes.saveChanges") : t("settings.account.customThemes.createTheme")}
                        onClick={handleSave}
                        type="primary"
                        disabled={saving || !editorName.trim() || !editorCSS.trim()}
                    />
                </div>
            </div>
        </DialogProvider>
    );
};
