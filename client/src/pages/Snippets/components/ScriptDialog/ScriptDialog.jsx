import "./styles.sass";
import { DialogProvider } from "@/common/components/Dialog";
import { useState, useEffect, useRef } from "react";
import { getRequest, postRequest, putRequest } from "@/common/utils/RequestUtil.js";
import Button from "@/common/components/Button";
import IconInput from "@/common/components/IconInput";
import { mdiFormTextbox, mdiFileDocument, mdiCheck, mdiClose, mdiCodeTags, mdiLightbulb, mdiScript } from "@mdi/js";
import Icon from "@mdi/react";
import Editor, { loader } from "@monaco-editor/react";
import { registerNextermLanguage } from "@/common/monaco/nexterm-lang.js";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { useTranslation } from "react-i18next";
import { useScripts } from "@/common/contexts/ScriptContext.jsx";
import * as monaco from "monaco-editor";

loader.config({ monaco });

export const ScriptDialog = ({ open, onClose, editScriptId, selectedOrganization }) => {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [content, setContent] = useState("");
    const editorRef = useRef(null);
    const initialValues = useRef({ name: '', description: '', content: '' });

    const { sendToast } = useToast();
    const { t } = useTranslation();
    const { loadScripts, loadAllScripts } = useScripts();
    const [creating, setCreating] = useState(false);

    const isEditing = !!editScriptId;

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
        if (open) {
            if (editScriptId) {
                loadScriptData();
            } else {
                resetForm();
            }
        }
    }, [open, editScriptId]);

    const loadScriptData = async () => {
        try {
            const queryParams = selectedOrganization ? `?organizationId=${selectedOrganization}` : "";
            const script = await getRequest(`scripts/${editScriptId}${queryParams}`);
            setName(script.name || "");
            setDescription(script.description || "");
            setContent(script.content || getDefaultContent());
            initialValues.current = { 
                name: script.name || '', 
                description: script.description || '', 
                content: script.content || getDefaultContent() 
            };
        } catch (error) {
            console.error("Failed to load script:", error);
            sendToast("Error", t("scripts.messages.errors.loadFailed"));
            onClose();
        }
    };

    const createScript = async () => {
        if (!name.trim()) {
            sendToast("Error", t("scripts.dialog.errors.nameRequired"));
            return;
        }

        if (!description.trim()) {
            sendToast("Error", t("scripts.dialog.errors.descriptionRequired"));
            return;
        }

        if (!content.trim()) {
            sendToast("Error", t("scripts.dialog.errors.contentRequired"));
            return;
        }

        setCreating(true);

        try {
            if (isEditing) {
                const scriptData = {
                    name: name.trim(),
                    description: description.trim(),
                    content: content.trim(),
                };
                const queryParams = selectedOrganization ? `?organizationId=${selectedOrganization}` : "";
                await putRequest(`scripts/${editScriptId}${queryParams}`, scriptData);
                sendToast("Success", t("scripts.messages.success.updated"));
            } else {
                const scriptData = {
                    name: name.trim(),
                    description: description.trim(),
                    content: content.trim(),
                    organizationId: selectedOrganization || undefined,
                };
                await postRequest("scripts", scriptData);
                sendToast("Success", t("scripts.messages.success.created"));
            }

            if (selectedOrganization) {
                await loadScripts(selectedOrganization);
            } else {
                await loadScripts();
            }
            await loadAllScripts();
            onClose();
            resetForm();
        } catch (err) {
            sendToast("Error", err.message || t(`scripts.dialog.errors.${isEditing ? "updateFailed" : "createFailed"}`));
        } finally {
            setCreating(false);
        }
    };

    const resetForm = () => {
        const defaultContent = getDefaultContent();
        setName("");
        setDescription("");
        setContent(defaultContent);
        initialValues.current = { name: '', description: '', content: defaultContent };
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const isDirty = name !== initialValues.current.name || 
                     description !== initialValues.current.description || 
                     content !== initialValues.current.content;

    return (
        <DialogProvider open={open} onClose={handleClose} isDirty={isDirty}>
            <div className="create-script-dialog">
                <div className="dialog-header">
                    <h2>
                        <Icon path={mdiScript} />
                        {isEditing ? t("scripts.dialog.title.edit") : t("scripts.dialog.title.create")}
                    </h2>
                </div>

                <div className="dialog-body">
                    <div className="form-section">
                        <h3>
                            <Icon path={mdiFormTextbox} />
                            {t("scripts.dialog.scriptDetails")}
                        </h3>

                        <div className="form-row">
                            <div className="form-group">
                                <label>{t("scripts.dialog.fields.name")}</label>
                                <IconInput
                                    icon={mdiFormTextbox}
                                    value={name}
                                    setValue={setName}
                                    placeholder={t("scripts.dialog.placeholders.name")}
                                />
                            </div>

                            <div className="form-group">
                                <label>{t("scripts.dialog.fields.description")}</label>
                                <IconInput
                                    icon={mdiFileDocument}
                                    value={description}
                                    setValue={setDescription}
                                    placeholder={t("scripts.dialog.placeholders.description")}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3>
                            <Icon path={mdiCodeTags} />
                            {t("scripts.dialog.scriptContent")}
                            <div className="help-tip">
                                <Icon path={mdiLightbulb} />
                                <span>{t("scripts.dialog.helpTip")}</span>
                            </div>
                        </h3>

                        <div className="code-editor-container">
                            <Editor
                                value={content}
                                height="400px"
                                language="nexterm"
                                theme="nexterm-dark"
                                onChange={(value) => setContent(value || "")}
                                onMount={(editor, monaco) => {
                                    editorRef.current = editor;
                                    registerNextermLanguage(monaco);
                                    monaco.editor.setTheme("nexterm-dark");
                                }}
                                options={{
                                    minimap: { enabled: false },
                                    fontSize: 14,
                                    lineNumbers: "on",
                                    scrollBeyondLastLine: false,
                                    automaticLayout: true,
                                    wordWrap: "off",
                                    tabSize: 4,
                                    insertSpaces: true,
                                    folding: true,
                                }}
                            />
                        </div>
                    </div>
                </div>

                <div className="dialog-actions">
                    <Button
                        onClick={handleClose}
                        text={t("scripts.dialog.actions.cancel")}
                        type="secondary"
                        icon={mdiClose}
                        disabled={creating}
                    />
                    <Button
                        onClick={createScript}
                        text={creating ? t(`scripts.dialog.actions.${isEditing ? "updating" : "creating"}`) : t(`scripts.dialog.actions.${isEditing ? "update" : "create"}`)}
                        icon={mdiCheck}
                        disabled={creating}
                    />
                </div>
            </div>
        </DialogProvider>
    );
};
