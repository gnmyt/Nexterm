import "./styles.sass";
import { DialogProvider } from "@/common/components/Dialog";
import { useEffect, useState, useRef } from "react";
import { getRequest, patchRequest, putRequest, postRequest } from "@/common/utils/RequestUtil.js";
import Button from "@/common/components/Button";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { useSnippets } from "@/common/contexts/SnippetContext.jsx";
import { useAI } from "@/common/contexts/AIContext.jsx";
import IconInput from "@/common/components/IconInput";
import SelectBox from "@/common/components/SelectBox";
import { mdiFormTextbox, mdiTextBox, mdiRobot, mdiCodeBrackets } from "@mdi/js";
import Icon from "@mdi/react";
import { useTranslation } from "react-i18next";
import { OS_OPTIONS, parseOsFilter } from "@/common/utils/osUtils.js";

export const SnippetDialog = ({ open, onClose, editSnippetId, selectedOrganization }) => {
    const { t } = useTranslation();
    const [name, setName] = useState("");
    const [command, setCommand] = useState("");
    const [description, setDescription] = useState("");
    const [osFilter, setOsFilter] = useState([]);
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const { sendToast } = useToast();
    const { loadAllSnippets } = useSnippets();
    const { isAIAvailable } = useAI();
    
    const initialValues = useRef({ name: '', command: '', description: '', osFilter: [] });

    useEffect(() => {
        if (open) {
            if (editSnippetId) {
                loadSnippetData();
            } else {
                resetForm();
            }
        }
    }, [open, editSnippetId]);

    const loadSnippetData = async () => {
        try {
            const queryParams = selectedOrganization ? `?organizationId=${selectedOrganization}` : '';
            const snippet = await getRequest(`snippets/${editSnippetId}${queryParams}`);
            const parsedOsFilter = parseOsFilter(snippet.osFilter);
            setName(snippet.name);
            setCommand(snippet.command);
            setDescription(snippet.description || "");
            setOsFilter(parsedOsFilter);
            initialValues.current = { name: snippet.name, command: snippet.command, description: snippet.description || '', osFilter: parsedOsFilter };
        } catch (error) {
            console.error("Failed to load snippet:", error);
            sendToast("Error", t('snippets.messages.errors.loadFailed'));
            onClose();
        }
    };

    const resetForm = () => {
        setName("");
        setCommand("");
        setDescription("");
        setOsFilter([]);
        initialValues.current = { name: '', command: '', description: '', osFilter: [] };
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim() || !command.trim()) {
            sendToast("Error", t('snippets.messages.errors.required'));
            return;
        }

        try {
            if (editSnippetId) {
                const snippetData = {
                    name,
                    command,
                    description: description || undefined,
                    osFilter: osFilter.length > 0 ? osFilter : null,
                };
                const queryParams = selectedOrganization ? `?organizationId=${selectedOrganization}` : '';
                await patchRequest(`snippets/${editSnippetId}${queryParams}`, snippetData);
                sendToast("Success", t('snippets.messages.success.updated'));
            } else {
                const snippetData = {
                    name,
                    command,
                    description: description || undefined,
                    organizationId: selectedOrganization || undefined,
                    osFilter: osFilter.length > 0 ? osFilter : null,
                };
                await putRequest("snippets", snippetData);
                sendToast("Success", t('snippets.messages.success.created'));
            }
            
            await loadAllSnippets();
            onClose();
        } catch (error) {
            sendToast("Error", error.message || t('snippets.messages.errors.saveFailed'));
        }
    };

    const handleClose = (event) => {
        event.preventDefault();
        onClose();
    };

    const handleGenerateAICommand = async () => {
        if (!name.trim() || !description.trim()) return;

        setIsGeneratingAI(true);

        try {
            const response = await postRequest("ai/generate", { prompt: `${name}: ${description}` });
            setCommand(response.command);
        } catch (error) {
            console.error("Error generating AI command:", error);
        } finally {
            setIsGeneratingAI(false);
        }
    };

    const arraysEqual = (a, b) => {
        if (a.length !== b.length) return false;
        return a.every((val, i) => val === b[i]);
    };

    const isDirty = name !== initialValues.current.name || 
                     command !== initialValues.current.command || 
                     description !== initialValues.current.description ||
                     !arraysEqual(osFilter, initialValues.current.osFilter);

    return (
        <DialogProvider open={open} onClose={onClose} isDirty={isDirty}>
            <div className="snippet-dialog">
                <div className="snippet-dialog-title">
                    <h2>
                        <Icon path={mdiCodeBrackets} />
                        {editSnippetId ? t('snippets.dialog.title.edit') : t('snippets.dialog.title.create')}
                    </h2>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="dialog-content">
                        <div className="form-group">
                            <label htmlFor="name">{t('snippets.dialog.fields.name')}</label>
                            <IconInput icon={mdiFormTextbox} value={name} setValue={setName} 
                                       placeholder={t('snippets.dialog.placeholders.name')} id="name" />
                        </div>

                        <div className="form-group">
                            <label htmlFor="description">{t('snippets.dialog.fields.description')}</label>
                            <IconInput icon={mdiTextBox} value={description} setValue={setDescription}
                                       placeholder={t('snippets.dialog.placeholders.description')} id="description" />
                        </div>

                        <div className="form-group">
                            <label>{t('snippets.dialog.fields.osFilter')}</label>
                            <SelectBox 
                                options={OS_OPTIONS} 
                                selected={osFilter} 
                                setSelected={setOsFilter} 
                                multiple={true}
                                placeholder={t('snippets.dialog.placeholders.osFilter')}
                            />
                        </div>

                        <div className="form-group">
                            <div className="command-label-with-ai">
                                <label htmlFor="command">{t('snippets.dialog.fields.command')}</label>
                                {name.trim() && description.trim() && isAIAvailable() && (
                                    <Button text={isGeneratingAI ? t('snippets.dialog.actions.generating') : t('snippets.dialog.actions.generateAI')} 
                                            icon={mdiRobot} onClick={handleGenerateAICommand} disabled={isGeneratingAI}
                                            type="secondary" />
                                )}
                            </div>
                            <div className="textarea-container">
                                <textarea id="command" value={command} onChange={(e) => setCommand(e.target.value)}
                                          placeholder={t('snippets.dialog.placeholders.command')} rows={5} className="custom-textarea" />
                            </div>
                        </div>
                    </div>

                    <div className="dialog-actions">
                        <Button text={t('snippets.dialog.actions.cancel')} onClick={handleClose} type="secondary" />
                        <Button text={editSnippetId ? t('snippets.dialog.actions.save') : t('snippets.dialog.actions.create')} type="primary" />
                    </div>
                </form>
            </div>
        </DialogProvider>
    );
};