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

export const ScriptDialog = ({ open, onClose, onScriptCreated, onScriptUpdated, editingScript, viewingScript }) => {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [content, setContent] = useState("");

    const { sendToast } = useToast();
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
         @NEXTERM:INFO "Switching to stable version"
    fi
else
    @NEXTERM:STEP "Standard installation process"
    echo "Installing stable version of $APP_NAME..."
fi`;
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
            sendToast("Error", "Script name is required");
            return;
        }

        if (!description.trim()) {
            sendToast("Error", "Script description is required");
            return;
        }

        if (!content.trim()) {
            sendToast("Error", "Script content cannot be empty");
            return;
        }

        setCreating(true);

        try {
            const scriptData = { name: name.trim(), description: description.trim(), content: content.trim() };

            let script;
            if (isEditing) {
                script = await putRequest(`scripts/${editingScript.id.replace(/\//g, "%2F")}`, scriptData);
                sendToast("Success", "Script updated successfully");
                onScriptUpdated && onScriptUpdated(script);
            } else {
                script = await postRequest("scripts", scriptData);
                sendToast("Success", "Script created successfully");
                onScriptCreated && onScriptCreated(script);
            }

            onClose();
            resetForm();
        } catch (err) {
            sendToast("Error", err.message || `Failed to ${isEditing ? "update" : "create"} script`);
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
                    <h2>{isViewing ? "View Script" : (isEditing ? "Edit Script" : "Create Custom Script")}</h2>
                    {isViewing && <p>Source: {viewingScript?.source}</p>}
                </div>

                <div className="dialog-body">
                    {!isViewing && (
                        <div className="form-section">
                            <h3>
                                <Icon path={mdiFormTextbox} />
                                Script Details
                            </h3>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Script Name *</label>
                                    <IconInput icon={mdiFormTextbox} value={name} setValue={setName}
                                               placeholder="My Awesome Script" />
                                </div>

                                <div className="form-group">
                                    <label>Description *</label>
                                    <IconInput icon={mdiFileDocument} value={description} setValue={setDescription}
                                               placeholder="What does this script do?" />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="form-section">
                        <h3>
                            <Icon path={mdiCodeTags} />
                            Script Content
                            {!isViewing && (
                                <div className="help-tip">
                                    <Icon path={mdiLightbulb} />
                                    <span>Use @NEXTERM: commands for interactive prompts</span>
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
                    <Button onClick={handleClose} text={isViewing ? "Close" : "Cancel"} type="secondary" icon={mdiClose}
                            disabled={creating} />
                    {!isViewing && (
                        <Button onClick={createScript}
                                text={creating ? `${isEditing ? "Updating" : "Creating"}...` : `${isEditing ? "Update" : "Create"} Script`}
                                icon={mdiCheck} disabled={creating} />
                    )}
                </div>
            </div>
        </DialogProvider>
    );
};
