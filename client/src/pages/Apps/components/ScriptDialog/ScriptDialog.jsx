import "./styles.sass";
import { DialogProvider } from "@/common/components/Dialog";
import { useState, useEffect } from "react";
import { postRequest, putRequest } from "@/common/utils/RequestUtil.js";
import Button from "@/common/components/Button";
import IconInput from "@/common/components/IconInput";
import { mdiFormTextbox, mdiFileDocument, mdiCheck, mdiClose, mdiCodeTags, mdiLightbulb } from "@mdi/js";
import Icon from "@mdi/react";
import CodeMirror from "@uiw/react-codemirror";
import { githubDark } from "@uiw/codemirror-theme-github";
import { nextermLanguage } from "@/common/codemirror/nexterm-lang.js";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { useTranslation } from "react-i18next";

export const ScriptDialog = ({ open, onClose, onScriptCreated, onScriptUpdated, editingScript, viewingScript }) => {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [content, setContent] = useState("");

    const { sendToast } = useToast();
    const { t } = useTranslation();
    const [creating, setCreating] = useState(false);

    const isEditing = !!editingScript;
    const isViewing = !!viewingScript;

    const getDefaultContent = () => {
        return `@NEXTERM:STEP "Getting user preferences"
@NEXTERM:INPUT APP_NAME "Which application would you like to install?" "nginx"
@NEXTERM:SELECT INSTALL_TYPE "Choose installation type" stable testing "development version"

if [ "$INSTALL_TYPE" = "development version" ]; then
    @NEXTERM:WARN "Development version may be unstable"
    @NEXTERM:CONFIRM "Are you sure you want to continue with development version?"
    
    if [ "$NEXTERM_CONFIRM_RESULT" = "Yes" ]; then
         @NEXTERM:INFO "Setting up development environment"
    fi
else
    @NEXTERM:STEP "Standard installation process"
    echo "Installing stable version of $APP_NAME..."
fi

@NEXTERM:SUMMARY "System Information" "OS" "$(lsb_release -d | cut -f2)" "User" "$(whoami)" "Memory" "$(free -h | grep '^Mem:' | awk '{print $2}')"`;
    };

    useEffect(() => {
        if (editingScript) {
            setName(editingScript.name || "");
            setDescription(editingScript.description || "");
            setContent(editingScript.content || getDefaultContent());
        } else if (viewingScript) {
            setName(viewingScript.name || "");
            setDescription(viewingScript.description || "");
            setContent(viewingScript.content || "");
        } else {
            resetForm();
        }
    }, [editingScript, viewingScript, open]);

    const createScript = async () => {
        if (!name.trim()) {
            sendToast("Error", t("apps.dialogs.script.errors.nameRequired"));
            return;
        }

        if (!description.trim()) {
            sendToast("Error", t("apps.dialogs.script.errors.descriptionRequired"));
            return;
        }

        if (!content.trim()) {
            sendToast("Error", t("apps.dialogs.script.errors.contentRequired"));
            return;
        }

        setCreating(true);

        try {
            const scriptData = { name: name.trim(), description: description.trim(), content: content.trim() };

            let script;
            if (isEditing) {
                script = await putRequest(`scripts/${editingScript.id.replace(/\//g, "%2F")}`, scriptData);
                sendToast("Success", t("apps.dialogs.script.success.updated"));
                onScriptUpdated && onScriptUpdated(script);
            } else {
                script = await postRequest("scripts", scriptData);
                sendToast("Success", t("apps.dialogs.script.success.created"));
                onScriptCreated && onScriptCreated(script);
            }

            onClose();
            resetForm();
        } catch (err) {
            sendToast("Error", err.message || t(`apps.dialogs.script.errors.${isEditing ? "updateFailed" : "createFailed"}`));
        } finally {
            setCreating(false);
        }
    };

    const resetForm = () => {
        setName("");
        setDescription("");
        setContent(getDefaultContent());
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    return (
        <DialogProvider open={open} onClose={handleClose}>
            <div className="create-script-dialog">
                <div className="dialog-header">
                    <h2>{isViewing ? t("apps.dialogs.script.viewTitle") : (isEditing ? t("apps.dialogs.script.editTitle") : t("apps.dialogs.script.createTitle"))}</h2>
                    {isViewing && <p>{t("apps.dialogs.script.source", { source: viewingScript?.source })}</p>}
                </div>

                <div className="dialog-body">
                    {!isViewing && (
                        <div className="form-section">
                            <h3>
                                <Icon path={mdiFormTextbox} />
                                {t("apps.dialogs.script.scriptDetails")}
                            </h3>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>{t("apps.dialogs.script.fields.name")}</label>
                                    <IconInput icon={mdiFormTextbox} value={name} setValue={setName}
                                               placeholder={t("apps.dialogs.script.fields.namePlaceholder")} />
                                </div>

                                <div className="form-group">
                                    <label>{t("apps.dialogs.script.fields.description")}</label>
                                    <IconInput icon={mdiFileDocument} value={description} setValue={setDescription}
                                               placeholder={t("apps.dialogs.script.fields.descriptionPlaceholder")} />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="form-section">
                        <h3>
                            <Icon path={mdiCodeTags} />
                            {t("apps.dialogs.script.scriptContent")}
                            {!isViewing && (
                                <div className="help-tip">
                                    <Icon path={mdiLightbulb} />
                                    <span>{t("apps.dialogs.script.helpTip")}</span>
                                </div>
                            )}
                        </h3>

                        <div className="code-editor-container">
                            <CodeMirror
                                value={content}
                                height="400px"
                                theme={githubDark}
                                extensions={nextermLanguage()}
                                onChange={isViewing ? undefined : (value) => setContent(value)}
                                editable={!isViewing}
                                basicSetup={{
                                    lineNumbers: true,
                                    foldGutter: true,
                                    dropCursor: !isViewing,
                                    allowMultipleSelections: !isViewing,
                                    highlightSelectionMatches: !isViewing,
                                }}
                            />
                        </div>
                    </div>
                </div>

                <div className="dialog-actions">
                    <Button onClick={handleClose} text={isViewing ? t("apps.dialogs.script.actions.close") : t("apps.dialogs.script.actions.cancel")} type="secondary" icon={mdiClose}
                            disabled={creating} />
                    {!isViewing && (
                        <Button onClick={createScript}
                                text={creating ? t(`apps.dialogs.script.actions.${isEditing ? "updating" : "creating"}`) : t(`apps.dialogs.script.actions.${isEditing ? "update" : "create"}`)}
                                icon={mdiCheck} disabled={creating} />
                    )}
                </div>
            </div>
        </DialogProvider>
    );
};
