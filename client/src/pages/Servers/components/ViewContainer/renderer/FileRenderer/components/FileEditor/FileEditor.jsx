import CodeMirror from "@uiw/react-codemirror";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "./styles.sass";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { downloadRequest } from "@/common/utils/RequestUtil.js";
import Icon from "@mdi/react";
import { mdiClose, mdiContentSave, mdiTextBox } from "@mdi/js";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";
import { useTheme } from "@/common/contexts/ThemeContext.jsx";

export const FileEditor = ({ currentFile, session, setCurrentFile, sendOperation }) => {
    const { t } = useTranslation();
    const [fileContent, setFileContent] = useState("");
    const [fileContentChanged, setFileContentChanged] = useState(false);
    const { theme } = useTheme();

    const toBase64 = (bytes) => {
        const binString = String.fromCodePoint(...bytes);
        return btoa(binString);
    }

    const [unsavedChangesDialog, setUnsavedChangesDialog] = useState(false);

    const { sessionToken } = useContext(UserContext);

    useEffect(() => {
        if (currentFile === null) return setFileContent(null);
        
        let url = `/api/entries/sftp-download?entryId=${session.server}&identityId=${session.identity}&path=${currentFile}&sessionToken=${sessionToken}`;
        if (session.connectionReason) {
            url += `&connectionReason=${encodeURIComponent(session.connectionReason)}`;
        }

        downloadRequest(url).then((res) => {
            const reader = new FileReader();
            reader.onload = () => {
                setFileContent(reader.result);
            };
            reader.readAsText(res);
        });
    }, [currentFile]);

    useEffect(() => {
        return () => setFileContent(null);
    }, []);

    const saveFile = () => {
        sendOperation(0x2, { path: currentFile });

        const chunks = [];
        for (let i = 0; i < fileContent.length; i += 1024) {
            chunks.push(toBase64(new TextEncoder().encode(fileContent.substring(i, i + 1024))));
        }

        for (let i = 0; i < chunks.length; i++) {
            sendOperation(0x3, { chunk: chunks[i] });
        }

        sendOperation(0x4);

        setFileContentChanged(false);
    };

    const closeFile = () => {
        if (fileContentChanged) {
            setUnsavedChangesDialog(true);
        } else {
            setCurrentFile(null);
        }
    }

    const updateContent = (value) => {
        setFileContentChanged(true);
        setFileContent(value);
    };

    return (
        <div className="file-editor">
            <ActionConfirmDialog text={t('servers.fileManager.fileEditor.unsavedChanges')}
                                 onConfirm={() => setCurrentFile(null)}
                                 open={unsavedChangesDialog} setOpen={setUnsavedChangesDialog} />
            <div className="file-header">
                <div className="file-name">
                    <Icon path={mdiTextBox} />
                    <h2>{currentFile}</h2>
                </div>
                <div className="file-actions">
                    <Icon path={mdiContentSave} onClick={() => saveFile()} className={fileContentChanged ? "" : " icon-disabled"} />
                    <Icon path={mdiClose} onClick={() => closeFile()} />
                </div>
            </div>
            <CodeMirror value={fileContent === null ? t('servers.fileManager.fileEditor.loading') : fileContent} onChange={updateContent}
                        theme={theme === 'dark' ? githubDark : githubLight} />
        </div>
    );
};