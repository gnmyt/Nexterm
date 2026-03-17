import "./styles.sass";
import {useState, useEffect} from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faDownload, faSpinner, faCircleExclamation, faServer, faArrowRight} from "@fortawesome/free-solid-svg-icons";
import {faWindows, faApple, faLinux, faAndroid} from "@fortawesome/free-brands-svg-icons";
import Footer from "@/pages/Home/components/Footer";
import {Link} from "react-router-dom";

const GITHUB_API = "https://api.github.com/repos/gnmyt/Nexterm/releases/latest";

const platforms = [
    {
        id: 'windows',
        icon: faWindows,
        name: 'Windows',
        assets: [
            { pattern: 'connector-windows-x64.exe', label: 'Download .exe', primary: true },
            { pattern: 'connector-windows-x64.msi', label: '.msi' },
            { pattern: 'connector-windows-arm64.exe', label: 'ARM64' }
        ]
    },
    {
        id: 'macos',
        icon: faApple,
        name: 'macOS',
        assets: [
            { pattern: 'connector-macos-arm64.dmg', label: 'Download .dmg', primary: true },
            { pattern: 'connector-macos-x64.dmg', label: 'Intel' }
        ]
    },
    {
        id: 'linux',
        icon: faLinux,
        name: 'Linux',
        assets: [
            { pattern: 'connector-linux-x64.AppImage', label: 'Download AppImage', primary: true },
            { pattern: 'connector-linux-x64.deb', label: '.deb' },
            { pattern: 'connector-linux-x64.rpm', label: '.rpm' }
        ]
    },
    {
        id: 'android',
        icon: faAndroid,
        name: 'Android',
        assets: [
            { pattern: 'universal.apk', label: 'Download APK', primary: true },
            { pattern: 'arm64-v8a.apk', label: 'ARM64' },
            { pattern: 'armeabi-v7a.apk', label: 'ARM32' }
        ]
    },
    {
        id: 'ios',
        icon: faApple,
        name: 'iOS',
        note: 'Requires sideloading',
        assets: [
            { pattern: '.ipa', label: 'Download IPA', primary: true }
        ]
    }
];

const findAsset = (assets, pattern) => {
    const asset = assets.find(a => a.name.includes(pattern));
    return asset?.browser_download_url || null;
};

export const Downloads = () => {
    const [release, setRelease] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetch(GITHUB_API)
            .then(res => res.ok ? res.json() : Promise.reject())
            .then(setRelease)
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, []);

    const assets = release?.assets || [];

    return (
        <div className="downloads-page">
            <div className="downloads-container">
                <header className="downloads-header">
                    <h1>Downloads</h1>
                    <p>Native apps for desktop and mobile</p>
                </header>

                {loading && (
                    <div className="downloads-state">
                        <FontAwesomeIcon icon={faSpinner} spin />
                        <span>Loading...</span>
                    </div>
                )}

                {error && (
                    <div className="downloads-state error">
                        <FontAwesomeIcon icon={faCircleExclamation} />
                        <span>Failed to load</span>
                    </div>
                )}

                {!loading && !error && (
                    <>
                        {release && (
                            <div className="version-info">
                                <span className="version-tag">{release.tag_name}</span>
                                <a href={release.html_url} target="_blank" rel="noopener noreferrer">
                                    Release notes
                                </a>
                            </div>
                        )}

                        <div className="platforms-list">
                            {platforms.map(platform => (
                                <div key={platform.id} className="platform-row">
                                    <div className="platform-info">
                                        <FontAwesomeIcon icon={platform.icon} />
                                        <span className="platform-name">{platform.name}</span>
                                        {platform.note && <span className="platform-note">{platform.note}</span>}
                                    </div>
                                    <div className="platform-downloads">
                                        {platform.assets.map((asset, i) => {
                                            const url = findAsset(assets, asset.pattern);
                                            if (!url) return null;
                                            return asset.primary ? (
                                                <a key={i} href={url} className="download-btn primary">
                                                    <FontAwesomeIcon icon={faDownload} />
                                                    {asset.label}
                                                </a>
                                            ) : (
                                                <a key={i} href={url} className="download-btn secondary">
                                                    {asset.label}
                                                </a>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="server-cta">
                            <FontAwesomeIcon icon={faServer} />
                            <span>Deploy the server with Docker</span>
                            <Link to="/install" className="server-cta-btn">
                                Install
                                <FontAwesomeIcon icon={faArrowRight} />
                            </Link>
                        </div>
                    </>
                )}
            </div>
            <Footer />
        </div>
    );
};
