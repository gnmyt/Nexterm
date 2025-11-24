import { useContext, useEffect, useState } from "react";
import SelectBox from "@/common/components/SelectBox";
import ToggleSwitch from "@/common/components/ToggleSwitch";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import Icon from "@mdi/react";
import { mdiServerNetwork, mdiClose, mdiPlus, mdiChartLine } from "@mdi/js";
import { useTranslation } from "react-i18next";

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

    const handleKeyboardLayoutChange = (newLayout) => {
        setKeyboardLayout(newLayout);
        setConfig(prev => ({ ...prev, keyboardLayout: newLayout }));
    };

    useEffect(() => {
        if (config?.keyboardLayout && config.keyboardLayout !== keyboardLayout) {
            setKeyboardLayout(config.keyboardLayout);
        }
    }, [config?.keyboardLayout]);

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

    if (!fieldConfig.showMonitoring && !fieldConfig.showKeyboardLayout && !showJumpHosts) {
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
                <div className="monitoring-toggle-container">
                    <div className="monitoring-toggle-info">
                        <span className="monitoring-label">
                            <Icon path={mdiChartLine} size={0.8} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                            {t('servers.dialog.settings.monitoring.title')}
                        </span>
                        <span className="monitoring-description">
                            {t('servers.dialog.settings.monitoring.description')}
                        </span>
                    </div>
                    <ToggleSwitch checked={monitoringEnabled} onChange={setMonitoringEnabled} id="monitoring-toggle" />
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
        </>
    );
};

export default SettingsPage;