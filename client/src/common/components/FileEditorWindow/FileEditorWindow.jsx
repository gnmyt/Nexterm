import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { usePreferences } from "@/common/contexts/PreferencesContext.jsx";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { downloadRequest, uploadFile } from "@/common/utils/RequestUtil.js";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";
import Editor, { loader } from "@monaco-editor/react";
import Icon from "@mdi/react";
import { mdiContentSave, mdiTextBox } from "@mdi/js";
import FloatingWindow, { FloatingWindowAction } from "@/common/components/FloatingWindow";
import "./styles.sass";
import * as monaco from "monaco-editor";

loader.config({ monaco });

const normalizeFilename = (filename) => filename?.toLowerCase() || "";

const getMonacoLanguage = (filename) => {
    const name = normalizeFilename(filename);
    if (!name) return "plaintext";

    const basename = name.split("/").pop() || "";

    const exactNameMap = {
        "dockerfile": "dockerfile",
        "makefile": "makefile",
        ".env": "ini",
    };

    if (exactNameMap[basename]) return exactNameMap[basename];

    const extension = basename.includes(".") ? basename.split(".").pop() : "";

    const extensionMap = {
        js: "javascript",
        mjs: "javascript",
        cjs: "javascript",
        jsx: "javascript",
        ts: "typescript",
        tsx: "typescript",
        json: "json",
        html: "html",
        htm: "html",
        css: "css",
        scss: "scss",
        sass: "scss",
        less: "less",
        md: "markdown",
        markdown: "markdown",
        yml: "yaml",
        yaml: "yaml",
        xml: "xml",
        sh: "shell",
        bash: "shell",
        zsh: "shell",
        py: "python",
        go: "go",
        java: "java",
        c: "c",
        h: "c",
        cpp: "cpp",
        cc: "cpp",
        cxx: "cpp",
        hpp: "cpp",
        hxx: "cpp",
        cs: "csharp",
        php: "php",
        rb: "ruby",
        rs: "rust",
        swift: "swift",
        kt: "kotlin",
        kts: "kotlin",
        sql: "sql",
        gql: "graphql",
        graphql: "graphql",
        toml: "toml",
        ini: "ini",
        conf: "ini",
        env: "ini",
        txt: "plaintext",
    };

    return extensionMap[extension] || "plaintext";
};

export const FileEditorWindow = ({ file, session, onClose }) => {
    const { t } = useTranslation();
    const { theme } = usePreferences();
    const { sessionToken } = useContext(UserContext);
    const { sendToast } = useToast();
    const [fileContent, setFileContent] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [fileContentChanged, setFileContentChanged] = useState(false);
    const [unsavedChangesDialog, setUnsavedChangesDialog] = useState(false);
    const [saving, setSaving] = useState(false);
    const [language, setLanguage] = useState("plaintext");

    useEffect(() => {
        if (!file) return;
        setIsLoading(true);
        setFileContent("");
        setFileContentChanged(false);
        setLanguage(getMonacoLanguage(file));

        const url = `/api/entries/sftp?sessionId=${session.id}&path=${file}&sessionToken=${sessionToken}`;
        downloadRequest(url).then((res) => {
            const reader = new FileReader();
            reader.onload = () => {
                setFileContent(reader.result);
                setIsLoading(false);
            };
            reader.readAsText(res);
        }).catch(() => {
            setIsLoading(false);
        });
    }, [file, session.id, sessionToken]);

    const saveFile = async () => {
        setSaving(true);
        try {
            const blob = new Blob([fileContent], { type: "application/octet-stream" });
            const url = `/api/entries/sftp/upload?sessionId=${session.id}&path=${encodeURIComponent(file)}&sessionToken=${sessionToken}`;
            await uploadFile(url, blob);
            setFileContentChanged(false);
            sendToast(t("common.success"), t("servers.fileManager.fileEditor.saveSuccess"));
        } catch (err) {
            sendToast(t("common.error"), err.message || t("servers.fileManager.fileEditor.saveFailed"));
        } finally {
            setSaving(false);
        }
    };

    const closeFile = () => fileContentChanged ? setUnsavedChangesDialog(true) : onClose();

    const updateContent = (value) => {
        setFileContentChanged(true);
        setFileContent(value);
    };

    if (!file) return null;

    return (
        <>
            <ActionConfirmDialog
                text={t("servers.fileManager.fileEditor.unsavedChanges")}
                onConfirm={onClose}
                open={unsavedChangesDialog}
                setOpen={setUnsavedChangesDialog}
            />

            <FloatingWindow
                className="file-editor-window"
                icon={mdiTextBox}
                title={file.split("/").pop()}
                titleExtra={fileContentChanged && <span className="modified-indicator">●</span>}
                onClose={closeFile}
                actions={
                    <FloatingWindowAction onClick={saveFile}
                            disabled={!fileContentChanged || saving} title={t("common.save")}>
                        <Icon path={mdiContentSave} />
                    </FloatingWindowAction>
                }
            >
                <div className="file-editor-content">
                    {isLoading ? (
                        <div className="file-editor-loading">
                            <div className="loading-spinner" />
                            <span>{t("servers.fileManager.fileEditor.loading")}</span>
                        </div>
                    ) : (
                        <Editor
                            value={fileContent}
                            onChange={updateContent}
                            language={language}
                            theme={theme === "dark" || theme === "oled" ? "vs-dark" : "vs-light"}
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
                    )}
                </div>
            </FloatingWindow>
        </>
    );
};
