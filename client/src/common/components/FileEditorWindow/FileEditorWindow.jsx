import { useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { usePreferences } from "@/common/contexts/PreferencesContext.jsx";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { useKeymaps } from "@/common/contexts/KeymapContext.jsx";
import { downloadRequest, uploadFile } from "@/common/utils/RequestUtil.js";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";
import Editor, { loader } from "@monaco-editor/react";
import Icon from "@mdi/react";
import { mdiContentSave } from "@mdi/js";
import { getFileIcon } from "@/common/utils/fileIcons.js";
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

const resolveMonacoKeyCode = (key) => {
    const normalized = key.toLowerCase();
    if (normalized.length === 1 && normalized >= "a" && normalized <= "z") {
        return monaco.KeyCode[`Key${normalized.toUpperCase()}`];
    }
    if (normalized.length === 1 && normalized >= "0" && normalized <= "9") {
        return monaco.KeyCode[`Digit${normalized}`];
    }
    const mapped = {
        enter: monaco.KeyCode.Enter,
        tab: monaco.KeyCode.Tab,
        space: monaco.KeyCode.Space,
        escape: monaco.KeyCode.Escape,
        backspace: monaco.KeyCode.Backspace,
        delete: monaco.KeyCode.Delete,
        up: monaco.KeyCode.UpArrow,
        down: monaco.KeyCode.DownArrow,
        left: monaco.KeyCode.LeftArrow,
        right: monaco.KeyCode.RightArrow,
        home: monaco.KeyCode.Home,
        end: monaco.KeyCode.End,
        pageup: monaco.KeyCode.PageUp,
        pagedown: monaco.KeyCode.PageDown,
        f1: monaco.KeyCode.F1,
        f2: monaco.KeyCode.F2,
        f3: monaco.KeyCode.F3,
        f4: monaco.KeyCode.F4,
        f5: monaco.KeyCode.F5,
        f6: monaco.KeyCode.F6,
        f7: monaco.KeyCode.F7,
        f8: monaco.KeyCode.F8,
        f9: monaco.KeyCode.F9,
        f10: monaco.KeyCode.F10,
        f11: monaco.KeyCode.F11,
        f12: monaco.KeyCode.F12,
    };
    return mapped[normalized] ?? null;
};

const toMonacoKeybinding = (keybind) => {
    if (!keybind) return null;
    const parts = keybind.toLowerCase().split("+");
    const code = resolveMonacoKeyCode(parts[parts.length - 1]);
    if (code == null) return null;
    let binding = code;
    if (parts.includes("ctrl") || parts.includes("meta")) binding |= monaco.KeyMod.CtrlCmd;
    if (parts.includes("shift")) binding |= monaco.KeyMod.Shift;
    if (parts.includes("alt")) binding |= monaco.KeyMod.Alt;
    return binding;
};

export const FileEditorWindow = ({ file, session, onClose }) => {
    const { t } = useTranslation();
    const { theme } = usePreferences();
    const { sessionToken } = useContext(UserContext);
    const { sendToast } = useToast();
    const { getKeybind, formatKey } = useKeymaps();
    const [fileContent, setFileContent] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [fileContentChanged, setFileContentChanged] = useState(false);
    const [unsavedChangesDialog, setUnsavedChangesDialog] = useState(false);
    const [saving, setSaving] = useState(false);
    const [language, setLanguage] = useState("plaintext");
    const [editorInstance, setEditorInstance] = useState(null);
    const saveFileRef = useRef(null);
    const saveKeybind = getKeybind("save-file");

    useEffect(() => {
        if (!file) return;
        setIsLoading(true);
        setFileContent("");
        setFileContentChanged(false);
        setLanguage(getMonacoLanguage(file));

        const url = `/api/entries/sftp?sessionId=${session.id}&path=${encodeURIComponent(file)}&sessionToken=${sessionToken}`;
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
        if (isLoading || !fileContentChanged || saving) return;
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

    useEffect(() => {
        saveFileRef.current = saveFile;
    });

    const handleEditorMount = (editor) => {
        setEditorInstance(editor);
    };

    useEffect(() => {
        if (!editorInstance || isLoading || !saveKeybind) return;
        const binding = toMonacoKeybinding(saveKeybind);
        if (!binding) return;
        const action = editorInstance.addAction({
            id: "nexterm-save-file",
            label: t("common.save"),
            keybindings: [binding],
            run: () => saveFileRef.current?.(),
        });
        return () => action?.dispose();
    }, [editorInstance, saveKeybind, isLoading, t]);

    const saveTitle = saveKeybind ? `${t("common.save")} (${formatKey(saveKeybind)})` : t("common.save");

    const updateContent = (value) => {
        setFileContentChanged(true);
        setFileContent(value);
    };

    if (!file) return null;

    const fileName = file.split("/").pop();

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
                icon={getFileIcon({ name: fileName, type: "file" })}
                title={fileName}
                titleExtra={fileContentChanged && <span className="modified-indicator">●</span>}
                onClose={closeFile}
                actions={
                    <FloatingWindowAction onClick={saveFile}
                            disabled={!fileContentChanged || saving} title={saveTitle}>
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
                            onMount={handleEditorMount}
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
