import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { getBaseUrl } from "@/common/utils/ConnectionUtil.js";
import { useTransfers } from "@/common/contexts/TransferContext.jsx";
import Icon from "@mdi/react";
import { mdiImage, mdiFileDownload } from "@mdi/js";
import FloatingWindow, { FloatingWindowAction } from "@/common/components/FloatingWindow";
import "./styles.sass";

export const FilePreviewWindow = ({ file, session, onClose }) => {
    const { t } = useTranslation();
    const { sessionToken } = useContext(UserContext);
    const { startDownload } = useTransfers();
    const [fileUrl, setFileUrl] = useState(null);
    const [fileType, setFileType] = useState(null);

    useEffect(() => {
        if (!file) {
            setFileUrl(null);
            setFileType(null);
            return;
        }

        const extension = file.split(".").pop()?.toLowerCase();
        const baseUrl = getBaseUrl();
        const url = `${baseUrl}/api/entries/sftp?sessionId=${session.id}&path=${encodeURIComponent(file)}&sessionToken=${sessionToken}&preview=true`;

        setFileUrl(url);

        const typeMap = {
            image: ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"],
            video: ["mp4", "webm", "ogg", "mov"],
            audio: ["mp3", "wav", "ogg", "flac", "m4a"],
            pdf: ["pdf"],
        };
        setFileType(Object.entries(typeMap).find(([, exts]) => exts.includes(extension))?.[0] || "unknown");
    }, [file, session.id, sessionToken]);

    const downloadFile = () => startDownload({ sessionId: session.id, sessionToken, baseUrl: getBaseUrl(), path: file });

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
        <FloatingWindow
            className="file-preview-window"
            icon={mdiImage}
            title={file.split("/").pop()}
            onClose={onClose}
            actions={
                <FloatingWindowAction onClick={downloadFile} title={t("common.download")}>
                    <Icon path={mdiFileDownload} />
                </FloatingWindowAction>
            }
        >
            {renderPreview()}
        </FloatingWindow>
    );
};
