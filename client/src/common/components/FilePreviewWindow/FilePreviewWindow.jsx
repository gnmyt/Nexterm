import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { useWindowControls } from "@/common/hooks/useWindowControls.js";
import Icon from "@mdi/react";
import {
    mdiClose,
    mdiImage,
    mdiFileDownload,
    mdiArrowAll,
    mdiWindowMaximize,
    mdiWindowRestore,
} from "@mdi/js";
import "./styles.sass";

export const FilePreviewWindow = ({ file, session, onClose, zIndex = 9999 }) => {
    const { t } = useTranslation();
    const { sessionToken } = useContext(UserContext);
    const [fileUrl, setFileUrl] = useState(null);
    const [fileType, setFileType] = useState(null);

    const {
        windowRef, headerRef, isMaximized, handleMouseDown,
        handleResizeStart, toggleMaximize, getWindowStyle, getWindowClasses,
    } = useWindowControls();

    useEffect(() => {
        if (!file) {
            setFileUrl(null);
            setFileType(null);
            return;
        }

        const extension = file.split(".").pop()?.toLowerCase();
        const url = `/api/entries/sftp-download?sessionId=${session.id}&path=${file}&sessionToken=${sessionToken}&preview=true`;

        setFileUrl(url);

        if (["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"].includes(extension)) {
            setFileType("image");
        } else if (["mp4", "webm", "ogg", "mov"].includes(extension)) {
            setFileType("video");
        } else if (["mp3", "wav", "ogg", "flac", "m4a"].includes(extension)) {
            setFileType("audio");
        } else if (["pdf"].includes(extension)) {
            setFileType("pdf");
        } else {
            setFileType("unknown");
        }
    }, [file, session.id, sessionToken]);

    const downloadFile = () => {
        const link = document.createElement("a");
        link.href = fileUrl;
        link.download = file.split("/").pop();
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const renderPreview = () => {
        switch (fileType) {
            case "image":
                return (
                    <div className="preview-content image-preview">
                        <img src={fileUrl} alt={file} />
                    </div>
                );
            case "video":
                return (
                    <div className="preview-content video-preview">
                        <video controls src={fileUrl}>
                            {t("servers.fileManager.filePreview.videoNotSupported")}
                        </video>
                    </div>
                );
            case "audio":
                return (
                    <div className="preview-content audio-preview">
                        <Icon path={mdiImage} size={3} />
                        <h3>{file.split("/").pop()}</h3>
                        <audio controls src={fileUrl}>
                            {t("servers.fileManager.filePreview.audioNotSupported")}
                        </audio>
                    </div>
                );
            case "pdf":
                return (
                    <div className="preview-content pdf-preview">
                        <iframe src={fileUrl} title={file} />
                    </div>
                );
            default:
                return (
                    <div className="preview-content unknown-preview">
                        <Icon path={mdiImage} size={3} />
                        <h3>{t("servers.fileManager.filePreview.cannotPreview")}</h3>
                        <p>{file.split("/").pop()}</p>
                    </div>
                );
        }
    };

    if (!file) return null;

    return (
        <div
            ref={windowRef}
            className={getWindowClasses("file-preview-window")}
            style={getWindowStyle(zIndex)}
        >
            <div
                ref={headerRef}
                className="file-preview-header"
                onMouseDown={handleMouseDown}
            >
                <div className="file-preview-title">
                    <Icon path={mdiImage} />
                    <h2>{file.split("/").pop()}</h2>
                </div>
                <div className="file-preview-actions">
                    <button
                        onClick={downloadFile}
                        className="action-btn"
                        title={t("common.download")}
                    >
                        <Icon path={mdiFileDownload} />
                    </button>
                    <button
                        onClick={toggleMaximize}
                        className="action-btn"
                        title={isMaximized ? t("common.restore") : t("common.maximize")}
                    >
                        <Icon path={isMaximized ? mdiWindowRestore : mdiWindowMaximize} />
                    </button>
                    <button
                        onClick={onClose}
                        className="action-btn close-btn"
                        title={t("common.close")}
                    >
                        <Icon path={mdiClose} />
                    </button>
                </div>
            </div>

            {renderPreview()}

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
