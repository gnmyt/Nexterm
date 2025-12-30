import "./styles.sass";
import { DialogProvider } from "@/common/components/Dialog";
import Icon from "@mdi/react";
import { mdiMicrosoftWindows, mdiApple, mdiLinux, mdiAndroid, mdiDownload, mdiLoading, mdiGooglePlay } from "@mdi/js";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { getRequest } from "@/common/utils/RequestUtil.js";
import { GITHUB_URL } from "@/App.jsx";
import { openExternalUrl } from "@/common/utils/TauriUtil.js";

const PLATFORMS = [
    {
        id: "windows",
        icon: mdiMicrosoftWindows,
        downloads: [
            { label: "EXE", arch: "x64", file: "nexterm-connector-windows-x64.exe" },
            { label: "MSI", arch: "x64", file: "nexterm-connector-windows-x64.msi" },
            { label: "EXE", arch: "ARM64", file: "nexterm-connector-windows-arm64.exe" },
        ],
    },
    {
        id: "macos",
        icon: mdiApple,
        downloads: [
            { label: "DMG", arch: "x64", file: "nexterm-connector-macos-x64.dmg" },
            { label: "DMG", arch: "ARM64", file: "nexterm-connector-macos-arm64.dmg" },
        ],
    },
    {
        id: "linux",
        icon: mdiLinux,
        downloads: [
            { label: "AppImage", arch: "x64", file: "nexterm-connector-linux-x64.AppImage" },
            { label: "DEB", arch: "x64", file: "nexterm-connector-linux-x64.deb" },
            { label: "RPM", arch: "x64", file: "nexterm-connector-linux-x64.rpm" },
        ],
    },
    {
        id: "android",
        icon: mdiAndroid,
        useVersionInFilename: true,
        downloads: [
            { label: "Google Play", arch: "Recommended", url: "https://play.google.com/store/apps/details?id=dev.gnm.nexterm", icon: mdiGooglePlay },
            { label: "APK", arch: "Universal", file: "universal" },
            { label: "APK", arch: "ARM64", file: "arm64-v8a" },
            { label: "APK", arch: "ARM32", file: "armeabi-v7a" },
            { label: "APK", arch: "x64", file: "x86_64" },
        ],
    },
];

const detectPlatform = () => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("android")) return "android";
    if (ua.includes("win")) return "windows";
    if (ua.includes("mac")) return "macos";
    if (ua.includes("linux")) return "linux";
    return "windows";
};

export const DownloadAppsDialog = ({ open, onClose }) => {
    const { t } = useTranslation();
    const [version, setVersion] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedPlatform, setSelectedPlatform] = useState(detectPlatform());

    useEffect(() => {
        if (open) {
            setLoading(true);
            setSelectedPlatform(detectPlatform());
            getRequest("service/version")
                .then(data => setVersion(data.version))
                .catch(() => setVersion(null))
                .finally(() => setLoading(false));
        }
    }, [open]);

    const getDownloadUrl = (platform, download) => {
        if (!version) return null;
        if (platform.useVersionInFilename) {
            return `${GITHUB_URL}/releases/download/v${version}/nexterm-${version}-${download.file}.apk`;
        }
        return `${GITHUB_URL}/releases/download/v${version}/${download.file}`;
    };

    const handleDownload = (platform, download) => {
        if (download.url) {
            openExternalUrl(download.url);
            return;
        }
        const url = getDownloadUrl(platform, download);
        if (url) {
            openExternalUrl(url);
        }
    };

    const currentPlatform = PLATFORMS.find(p => p.id === selectedPlatform);

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="download-apps-dialog">
                <div className="dialog-header">
                    <h2>{t("downloadApps.title")}</h2>
                    <p>{t("downloadApps.subtitle")}</p>
                </div>

                {loading ? (
                    <div className="loading-state">
                        <Icon path={mdiLoading} spin />
                    </div>
                ) : (
                    <>
                        <div className="platform-grid">
                            {PLATFORMS.map(platform => (
                                <div
                                    key={platform.id}
                                    className={`platform-card${selectedPlatform === platform.id ? " selected" : ""}`}
                                    onClick={() => setSelectedPlatform(platform.id)}
                                >
                                    <div className="platform-icon">
                                        <Icon path={platform.icon} />
                                    </div>
                                    <span className="platform-name">
                                        {t(`downloadApps.platforms.${platform.id}`)}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {currentPlatform && (
                            <div className="downloads-section">
                                <div className="downloads-grid">
                                    {currentPlatform.downloads.map(download => (
                                        <button
                                            key={download.file || download.url}
                                            className="download-btn"
                                            onClick={() => handleDownload(currentPlatform, download)}
                                        >
                                            <Icon path={download.icon || mdiDownload} className="btn-icon" />
                                            <div className="btn-text">
                                                <span className="btn-format">{download.label}</span>
                                                <span className="btn-arch">{download.arch}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </DialogProvider>
    );
};

export default DownloadAppsDialog;
