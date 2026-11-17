import "./styles.sass";
import { DialogProvider } from "@/common/components/Dialog";
import Icon from "@mdi/react";
import {
    mdiMicrosoftWindows, mdiApple, mdiLinux, mdiAndroid, mdiDownload, mdiLoading, mdiGooglePlay, mdiAppleIos,
    mdiCellphoneLink, mdiOpenInNew, mdiGithub, mdiAlertCircleOutline,
} from "@mdi/js";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { getRequest } from "@/common/utils/RequestUtil.js";
import { GITHUB_URL } from "@/App.jsx";
import { openExternalUrl } from "@/common/utils/TauriUtil.js";
import Button from "@/common/components/Button";

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
            { label: "Google Play", recommended: true, url: "https://play.google.com/store/apps/details?id=dev.gnm.nexterm", icon: mdiGooglePlay },
            { label: "APK", arch: "Universal", file: "universal" },
            { label: "APK", arch: "ARM64", file: "arm64-v8a" },
            { label: "APK", arch: "ARM32", file: "armeabi-v7a" },
            { label: "APK", arch: "x64", file: "x86_64" },
        ],
    },
    {
        id: "ios",
        icon: mdiAppleIos,
        useVersionInFilename: true,
        downloads: [
            { label: "App Store", recommended: true, url: "https://apps.apple.com/app/nexterm/id6761635144", icon: mdiApple },
            { label: "IPA", arch: "Universal", file: "ipa" },
        ],
    },
];

const detectPlatform = () => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("iphone") || ua.includes("ipad")) return "ios";
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

    const releasesUrl = version ? `${GITHUB_URL}/releases/tag/v${version}` : `${GITHUB_URL}/releases`;

    const getDownloadUrl = (platform, download) => {
        if (!version) return null;
        if (platform.useVersionInFilename) {
            if (platform.id === "ios") {
                return `${GITHUB_URL}/releases/download/v${version}/nexterm-${version}.ipa`;
            }
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
        if (url) openExternalUrl(url);
    };

    const currentPlatform = PLATFORMS.find(p => p.id === selectedPlatform);

    return (
        <DialogProvider open={open} onClose={onClose} className="download-apps">
            <div className="da">
                <header className="da-header dialog-heading">
                    <span className="da-header__icon"><Icon path={mdiCellphoneLink} /></span>
                    <div className="da-header__text">
                        <h2>{t("downloadApps.title")}</h2>
                        <p>{t("downloadApps.subtitle")}</p>
                    </div>
                </header>

                <div className="da-body">
                    {loading ? (
                        <div className="da-loading"><Icon path={mdiLoading} spin={1} /></div>
                    ) : (
                        <>
                            <div className="da-platforms" role="tablist" aria-label={t("downloadApps.title")}>
                                {PLATFORMS.map(platform => {
                                    const selected = selectedPlatform === platform.id;
                                    return (
                                        <button key={platform.id} type="button" role="tab" aria-selected={selected}
                                                className={`da-platform${selected ? " selected" : ""}`}
                                                onClick={() => setSelectedPlatform(platform.id)}>
                                            <span className="da-platform__icon"><Icon path={platform.icon} /></span>
                                            <span className="da-platform__label">{t(`downloadApps.platforms.${platform.id}`)}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {!version && (
                                <p className="da-note">
                                    <Icon path={mdiAlertCircleOutline} />
                                    <span>{t("downloadApps.versionUnavailable")}</span>
                                </p>
                            )}

                            {currentPlatform && (
                                <div className="da-downloads" role="tabpanel">
                                    {currentPlatform.downloads.map(download => {
                                        const external = Boolean(download.url);
                                        const unavailable = !external && !version;
                                        return (
                                            <button key={download.file || download.url || download.label} type="button"
                                                    className="da-download" disabled={unavailable}
                                                    onClick={() => handleDownload(currentPlatform, download)}>
                                                <span className="da-download__icon"><Icon path={download.icon || mdiDownload} /></span>
                                                <span className="da-download__text">
                                                    <span className="da-download__label">
                                                        {download.label}
                                                        {download.recommended && <em className="da-download__badge">{t("downloadApps.recommended")}</em>}
                                                    </span>
                                                    {download.arch && <span className="da-download__meta">{download.arch}</span>}
                                                </span>
                                                <Icon path={external ? mdiOpenInNew : mdiDownload} className="da-download__action" />
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </div>

                <footer className="da-footer">
                    <span>{t("downloadApps.sourceHint")}</span>
                    <Button type="secondary" size="small" icon={mdiGithub} text={t("downloadApps.allReleases")}
                            onClick={() => openExternalUrl(releasesUrl)} />
                </footer>
            </div>
        </DialogProvider>
    );
};

export default DownloadAppsDialog;
