import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { useTheme } from "@/common/contexts/ThemeContext.jsx";
import { downloadRequest } from "@/common/utils/RequestUtil.js";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";
import { useWindowControls } from "@/common/hooks/useWindowControls.js";
import Editor, { loader } from "@monaco-editor/react";
import Icon from "@mdi/react";
import { mdiClose, mdiContentSave, mdiTextBox, mdiArrowAll, mdiWindowMaximize, mdiWindowRestore } from "@mdi/js";
import "./styles.sass";
import * as monaco from "monaco-editor";

loader.config({ monaco });

export const FileEditorWindow = ({ file, session, onClose, sendOperation, zIndex = 9999 }) => {
    const { t } = useTranslation();
    const { theme } = useTheme();
    const { sessionToken } = useContext(UserContext);
    const [fileContent, setFileContent] = useState("");
    const [fileContentChanged, setFileContentChanged] = useState(false);
    const [unsavedChangesDialog, setUnsavedChangesDialog] = useState(false);

    const {
        windowRef, headerRef, isMaximized, handleMouseDown, handleResizeStart, toggleMaximize,
        getWindowStyle, getWindowClasses,
    } = useWindowControls();

    const toBase64 = (bytes) => btoa(String.fromCodePoint(...bytes));

    useEffect(() => {
        if (!file) return;

        const url = `/api/entries/sftp-download?sessionId=${session.id}&path=${file}&sessionToken=${sessionToken}`;
        downloadRequest(url).then((res) => {
            const reader = new FileReader();
            reader.onload = () => setFileContent(reader.result);
            reader.readAsText(res);
        });
    }, [file]);

    const saveFile = () => {
        sendOperation(0x2, { path: file });
        const encoder = new TextEncoder();
        for (let i = 0; i < fileContent.length; i += 1024) {
            sendOperation(0x3, { chunk: toBase64(encoder.encode(fileContent.substring(i, i + 1024))) });
        }
        sendOperation(0x4);
        setFileContentChanged(false);
    };

    const closeFile = () => fileContentChanged ? setUnsavedChangesDialog(true) : onClose();

    const updateContent = (value) => {
        setFileContentChanged(true);
        setFileContent(value);
    };

    if (!file) return null;

    return (
        <div
            ref={windowRef}
            className={getWindowClasses("file-editor-window")}
            style={getWindowStyle(zIndex)}
        >
            <ActionConfirmDialog
                text={t("servers.fileManager.fileEditor.unsavedChanges")}
                onConfirm={onClose}
                open={unsavedChangesDialog}
                setOpen={setUnsavedChangesDialog}
            />

            <div
                ref={headerRef}
                className="file-editor-header"
                onMouseDown={handleMouseDown}
            >
                <div className="file-editor-title">
                    <Icon path={mdiTextBox} />
                    <h2>{file.split("/").pop()}</h2>
                    {fileContentChanged && <span className="modified-indicator">●</span>}
                </div>
                <div className="file-editor-actions">
                    <button
                        onClick={saveFile}
                        disabled={!fileContentChanged}
                        className="action-btn"
                        title={t("common.save")}
                    >
                        <Icon path={mdiContentSave} />
                    </button>
                    <button
                        onClick={toggleMaximize}
                        className="action-btn"
                        title={isMaximized ? t("common.restore") : t("common.maximize")}
                    >
                        <Icon path={isMaximized ? mdiWindowRestore : mdiWindowMaximize} />
                    </button>
                    <button
                        onClick={closeFile}
                        className="action-btn close-btn"
                        title={t("common.close")}
                    >
                        <Icon path={mdiClose} />
                    </button>
                </div>
            </div>

            <div className="file-editor-content">
                <Editor
                    value={fileContent || t("servers.fileManager.fileEditor.loading")}
                    onChange={updateContent}
                    theme={theme === "dark" ? "vs-dark" : "vs-light"}
                    options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        lineNumbers: "on",
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        wordWrap: "off",
                        tabSize: 4,
                        insertSpaces: true,
                    }}
                />
            </div>

            {!isMaximized && (
                <div
                    className="resize-handle"
                    onMouseDown={handleResizeStart}
                >
                    <Icon path={mdiArrowAll} />
                </div>
            )}
        </div>
    );
};
