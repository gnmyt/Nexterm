import { useContext, useEffect, useState } from "react";
import SelectBox from "@/common/components/SelectBox";
import ToggleSwitch from "@/common/components/ToggleSwitch";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import Icon from "@mdi/react";
import { mdiServerNetwork, mdiClose, mdiPlus, mdiChartLine, mdiMonitor, mdiPalette, mdiVolumeHigh, mdiPowerPlug } from "@mdi/js";
import { useTranslation } from "react-i18next";

const COLOR_DEPTHS = [
    { label: "Auto", value: "" },
    { label: "256 colors (8-bit)", value: "8" },
    { label: "Low color (16-bit)", value: "16" },
    { label: "True color (24-bit)", value: "24" },
    { label: "True color (32-bit)", value: "32" },
];

const RESIZE_METHODS = [
    { label: "Display Update (recommended)", value: "display-update" },
    { label: "Reconnect", value: "reconnect" },
    { label: "None", value: "none" },
];

const KEYBOARD_LAYOUTS = [
    { label: "Dänisch (Qwerty)", value: "da-dk-qwerty" },
    { label: "Swiss German (Qwertz)", value: "de-ch-qwertz" },
    { label: "Deutsch (Qwertz)", value: "de-de-qwertz" },
    { label: "English (GB) (Qwerty)", value: "en-gb-qwerty" },
    { label: "English (US) (Qwerty)", value: "en-us-qwerty" },
    { label: "Spanisch (Qwerty)", value: "es-es-qwerty" },
    { label: "Latin American (Qwerty)", value: "es-latam-qwerty" },
    { label: "Unicode", value: "failsafe" },
    { label: "Belgian French (Azerty)", value: "fr-be-azerty" },
    { label: "Schweiz/Französisch (Qwertz)", value: "fr-ch-qwertz" },
    { label: "Französisch (Azerty)", value: "fr-fr-azerty" },
    { label: "Hungarian (Qwertz)", value: "hu-hu-qwertz" },
    { label: "Italienisch (Qwerty)", value: "it-it-qwerty" },
    { label: "Japanisch (Qwerty)", value: "ja-jp-qwerty" },
    { label: "Portugiesisch (BR) (Qwerty)", value: "pt-br-qwerty" },
    { label: "Schwedisch (Qwerty)", value: "sv-se-qwerty" },
    { label: "Türkisch (Qwerty)", value: "tr-tr-qwerty" }
];

const SettingsPage = ({ config, setConfig, monitoringEnabled, setMonitoringEnabled, fieldConfig, editServerId }) => {
    const { t } = useTranslation();
    const { servers } = useContext(ServerContext);
    const [keyboardLayout, setKeyboardLayout] = useState(config?.keyboardLayout || "en-us-qwerty");
    const [jumpHosts, setJumpHosts] = useState(config?.jumpHosts || []);
    const [availableJumpHosts, setAvailableJumpHosts] = useState([]);

    const [colorDepth, setColorDepth] = useState(config?.colorDepth || "");
    const [resizeMethod, setResizeMethod] = useState(config?.resizeMethod || "display-update");
    const [enableAudio, setEnableAudio] = useState(config?.enableAudio !== false);
    const [enableWallpaper, setEnableWallpaper] = useState(config?.enableWallpaper !== false);
    const [enableTheming, setEnableTheming] = useState(config?.enableTheming !== false);
    const [enableFontSmoothing, setEnableFontSmoothing] = useState(config?.enableFontSmoothing !== false);
    const [enableFullWindowDrag, setEnableFullWindowDrag] = useState(config?.enableFullWindowDrag === true);
    const [enableDesktopComposition, setEnableDesktopComposition] = useState(config?.enableDesktopComposition === true);
    const [enableMenuAnimations, setEnableMenuAnimations] = useState(config?.enableMenuAnimations === true);
    const [wakeOnLanEnabled, setWakeOnLanEnabled] = useState(config?.wakeOnLanEnabled === true);

    const handleKeyboardLayoutChange = (newLayout) => {
        setKeyboardLayout(newLayout);
        setConfig(prev => ({ ...prev, keyboardLayout: newLayout }));
    };

    const handleDisplaySettingChange = (key, value, setter) => {
        setter(value);
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    useEffect(() => {
        if (config?.keyboardLayout && config.keyboardLayout !== keyboardLayout) {
            setKeyboardLayout(config.keyboardLayout);
        }

        if (config?.colorDepth !== undefined) setColorDepth(config.colorDepth);
        if (config?.resizeMethod !== undefined) setResizeMethod(config.resizeMethod);
        if (config?.enableAudio !== undefined) setEnableAudio(config.enableAudio);
        if (config?.enableWallpaper !== undefined) setEnableWallpaper(config.enableWallpaper);
        if (config?.enableTheming !== undefined) setEnableTheming(config.enableTheming);
        if (config?.enableFontSmoothing !== undefined) setEnableFontSmoothing(config.enableFontSmoothing);
        if (config?.enableFullWindowDrag !== undefined) setEnableFullWindowDrag(config.enableFullWindowDrag);
        if (config?.enableDesktopComposition !== undefined) setEnableDesktopComposition(config.enableDesktopComposition);
        if (config?.enableMenuAnimations !== undefined) setEnableMenuAnimations(config.enableMenuAnimations);
        if (config?.wakeOnLanEnabled !== undefined) setWakeOnLanEnabled(config.wakeOnLanEnabled);
    }, [config]);

    useEffect(() => {
        if (config?.jumpHosts && JSON.stringify(config.jumpHosts) !== JSON.stringify(jumpHosts)) {
            setJumpHosts(config.jumpHosts);
        }
    }, [config?.jumpHosts]);

    useEffect(() => {
        if (!servers) return;

        const sshServers = [];
        const collectSSHServers = (entries) => {
            entries.forEach(entry => {
                if (entry.type === 'folder' || entry.type === 'organization') {
                    collectSSHServers(entry.entries || []);
                } else if (entry.type === 'server' && entry.protocol === 'ssh' && entry.id !== editServerId) {
                    sshServers.push(entry);
                }
            });
        };
        
        collectSSHServers(servers);
        setAvailableJumpHosts(sshServers);
    }, [servers, editServerId]);

    const handleJumpHostsChange = (newJumpHosts) => {
        setJumpHosts(newJumpHosts);
        setConfig(prev => ({ ...prev, jumpHosts: newJumpHosts }));
    };

    const addJumpHost = () => {
        if (availableJumpHosts.length === 0) return;
        const newJumpHosts = [...jumpHosts, availableJumpHosts[0].id];
        handleJumpHostsChange(newJumpHosts);
    };

    const removeJumpHost = (index) => {
        const newJumpHosts = jumpHosts.filter((_, i) => i !== index);
        handleJumpHostsChange(newJumpHosts);
    };

    const updateJumpHost = (index, serverId) => {
        const newJumpHosts = [...jumpHosts];
        newJumpHosts[index] = serverId;
        handleJumpHostsChange(newJumpHosts);
    };

    const getAvailableServersForPosition = (currentIndex) => {
        const selectedIds = jumpHosts.filter((_, i) => i !== currentIndex);
        return availableJumpHosts.filter(server => !selectedIds.includes(server.id));
    };

    const showJumpHosts = config?.protocol === 'ssh';

    if (!fieldConfig.showMonitoring && !fieldConfig.showKeyboardLayout && !fieldConfig.showDisplaySettings && !fieldConfig.showAudioSettings && !fieldConfig.showWakeOnLan && !showJumpHosts) {
        return <p className="text-center">{t('servers.dialog.settings.noSettings')}</p>;
    }

    return (
        <>
            {showJumpHosts && (
                <div className="jump-hosts-section">
                    <div className="jump-hosts-header">
                        <div className="jump-hosts-info">
                            <span className="jump-hosts-label">
                                <Icon path={mdiServerNetwork} size={0.8} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                                {t('servers.dialog.settings.jumpHosts.title')}
                            </span>
                            <span className="jump-hosts-description">
                                {t('servers.dialog.settings.jumpHosts.description')}
                            </span>
                        </div>
                    </div>
                    
                    {jumpHosts.length > 0 && (
                        <div className="jump-hosts-list">
                            {jumpHosts.map((jumpHostId, index) => {
                                const availableServers = getAvailableServersForPosition(index);
                                const serverOptions = availableServers.map(s => ({
                                    label: `${s.name} (${s.ip})`,
                                    value: s.id
                                }));
                                
                                return (
                                    <div key={index} className="jump-host-item">
                                        <span className="jump-host-number">{index + 1}</span>
                                        <div className="jump-host-select">
                                            <SelectBox 
                                                options={serverOptions}
                                                selected={jumpHostId}
                                                setSelected={(value) => updateJumpHost(index, value)}
                                                searchable={serverOptions.length > 5}
                                            />
                                        </div>
                                        <button 
                                            className="jump-host-remove"
                                            onClick={() => removeJumpHost(index)}
                                            title={t('servers.dialog.settings.jumpHosts.removeTooltip')}
                                        >
                                            <Icon path={mdiClose} size={0.8} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    
                    {availableJumpHosts.length > jumpHosts.length && (
                        <button className="add-jump-host-btn" onClick={addJumpHost}>
                            <Icon path={mdiPlus} size={0.8} />
                            {t('servers.dialog.settings.jumpHosts.addButton')}
                        </button>
                    )}
                    
                    {availableJumpHosts.length === 0 && (
                        <p className="no-jump-hosts-message">
                            {t('servers.dialog.settings.jumpHosts.noServersAvailable')}
                        </p>
                    )}
                </div>
            )}

            {fieldConfig.showMonitoring && (
                <div className="settings-toggle">
                    <div className="settings-toggle-info">
                        <span className="settings-toggle-label">
                            <Icon path={mdiChartLine} size={0.8} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                            {t('servers.dialog.settings.monitoring.title')}
                        </span>
                        <span className="settings-toggle-description">
                            {t('servers.dialog.settings.monitoring.description')}
                        </span>
                    </div>
                    <ToggleSwitch checked={monitoringEnabled} onChange={setMonitoringEnabled} id="monitoring-toggle" />
                </div>
            )}

            {fieldConfig.showWakeOnLan && (
                <div className="settings-toggle">
                    <div className="settings-toggle-info">
                        <span className="settings-toggle-label">
                            <Icon path={mdiPowerPlug} size={0.8} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                            {t('servers.dialog.settings.wakeOnLan.title')}
                        </span>
                        <span className="settings-toggle-description">
                            {t('servers.dialog.settings.wakeOnLan.description')}
                        </span>
                    </div>
                    <ToggleSwitch checked={wakeOnLanEnabled} onChange={(val) => handleDisplaySettingChange('wakeOnLanEnabled', val, setWakeOnLanEnabled)} id="wake-on-lan-toggle" />
                </div>
            )}

            {fieldConfig.showKeyboardLayout && (
                <div className="keyboard-layout-card">
                    <div className="form-group">
                        <label>{t('servers.dialog.settings.keyboardLayout.title')}</label>
                        <SelectBox options={KEYBOARD_LAYOUTS} selected={keyboardLayout} setSelected={handleKeyboardLayoutChange} />
                        <p className="keyboard-layout-description">{t('servers.dialog.settings.keyboardLayout.description')}</p>
                    </div>
                </div>
            )}

            {fieldConfig.showDisplaySettings && (
                <div className="jump-hosts-section">
                    <div className="jump-hosts-header">
                        <div className="jump-hosts-info">
                            <span className="jump-hosts-label">
                                <Icon path={mdiMonitor} size={0.8} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                                {t('servers.dialog.settings.display.title')}
                            </span>
                            <span className="jump-hosts-description">
                                {t('servers.dialog.settings.display.description')}
                            </span>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>{t('servers.dialog.settings.display.colorDepth')}</label>
                        <SelectBox 
                            options={COLOR_DEPTHS} 
                            selected={colorDepth} 
                            setSelected={(val) => handleDisplaySettingChange('colorDepth', val, setColorDepth)} 
                        />
                    </div>

                    <div className="form-group">
                        <label>{t('servers.dialog.settings.display.resizeMethod')}</label>
                        <SelectBox 
                            options={RESIZE_METHODS} 
                            selected={resizeMethod} 
                            setSelected={(val) => handleDisplaySettingChange('resizeMethod', val, setResizeMethod)} 
                        />
                    </div>
                </div>
            )}

            {fieldConfig.showAudioSettings && (
                <div className="settings-toggle">
                    <div className="settings-toggle-info">
                        <span className="settings-toggle-label">
                            <Icon path={mdiVolumeHigh} size={0.8} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                            {t('servers.dialog.settings.audio.enableAudio')}
                        </span>
                        <span className="settings-toggle-description">{t('servers.dialog.settings.audio.enableAudioDesc')}</span>
                    </div>
                    <ToggleSwitch checked={enableAudio} onChange={(val) => handleDisplaySettingChange('enableAudio', val, setEnableAudio)} id="enable-audio" />
                </div>
            )}

            {fieldConfig.showPerformanceSettings && (
                <div className="jump-hosts-section">
                    <div className="jump-hosts-header">
                        <div className="jump-hosts-info">
                            <span className="jump-hosts-label">
                                <Icon path={mdiPalette} size={0.8} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                                {t('servers.dialog.settings.performance.title')}
                            </span>
                            <span className="jump-hosts-description">
                                {t('servers.dialog.settings.performance.description')}
                            </span>
                        </div>
                    </div>

                    <div className="settings-toggle">
                        <div className="settings-toggle-info">
                            <span className="settings-toggle-label">{t('servers.dialog.settings.performance.enableWallpaper')}</span>
                            <span className="settings-toggle-description">{t('servers.dialog.settings.performance.enableWallpaperDesc')}</span>
                        </div>
                        <ToggleSwitch checked={enableWallpaper} onChange={(val) => handleDisplaySettingChange('enableWallpaper', val, setEnableWallpaper)} id="enable-wallpaper" />
                    </div>

                    <div className="settings-toggle">
                        <div className="settings-toggle-info">
                            <span className="settings-toggle-label">{t('servers.dialog.settings.performance.enableTheming')}</span>
                            <span className="settings-toggle-description">{t('servers.dialog.settings.performance.enableThemingDesc')}</span>
                        </div>
                        <ToggleSwitch checked={enableTheming} onChange={(val) => handleDisplaySettingChange('enableTheming', val, setEnableTheming)} id="enable-theming" />
                    </div>

                    <div className="settings-toggle">
                        <div className="settings-toggle-info">
                            <span className="settings-toggle-label">{t('servers.dialog.settings.performance.enableFontSmoothing')}</span>
                            <span className="settings-toggle-description">{t('servers.dialog.settings.performance.enableFontSmoothingDesc')}</span>
                        </div>
                        <ToggleSwitch checked={enableFontSmoothing} onChange={(val) => handleDisplaySettingChange('enableFontSmoothing', val, setEnableFontSmoothing)} id="enable-font-smoothing" />
                    </div>

                    <div className="settings-toggle">
                        <div className="settings-toggle-info">
                            <span className="settings-toggle-label">{t('servers.dialog.settings.performance.enableFullWindowDrag')}</span>
                            <span className="settings-toggle-description">{t('servers.dialog.settings.performance.enableFullWindowDragDesc')}</span>
                        </div>
                        <ToggleSwitch checked={enableFullWindowDrag} onChange={(val) => handleDisplaySettingChange('enableFullWindowDrag', val, setEnableFullWindowDrag)} id="enable-full-window-drag" />
                    </div>

                    <div className="settings-toggle">
                        <div className="settings-toggle-info">
                            <span className="settings-toggle-label">{t('servers.dialog.settings.performance.enableDesktopComposition')}</span>
                            <span className="settings-toggle-description">{t('servers.dialog.settings.performance.enableDesktopCompositionDesc')}</span>
                        </div>
                        <ToggleSwitch checked={enableDesktopComposition} onChange={(val) => handleDisplaySettingChange('enableDesktopComposition', val, setEnableDesktopComposition)} id="enable-desktop-composition" />
                    </div>

                    <div className="settings-toggle">
                        <div className="settings-toggle-info">
                            <span className="settings-toggle-label">{t('servers.dialog.settings.performance.enableMenuAnimations')}</span>
                            <span className="settings-toggle-description">{t('servers.dialog.settings.performance.enableMenuAnimationsDesc')}</span>
                        </div>
                        <ToggleSwitch checked={enableMenuAnimations} onChange={(val) => handleDisplaySettingChange('enableMenuAnimations', val, setEnableMenuAnimations)} id="enable-menu-animations" />
                    </div>
                </div>
            )}
        </>
    );
};

export default SettingsPage;