import { mdiFormTextbox, mdiIp, mdiEthernet, mdiContentDuplicate } from "@mdi/js";
import Icon from "@mdi/react";
import Input from "@/common/components/IconInput";
import SelectBox from "@/common/components/SelectBox";
import IconChooser from "../components/IconChooser";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { getRequest } from "@/common/utils/RequestUtil.js";

const PROTOCOL_OPTIONS = [
    { label: "SSH", value: "ssh" },
    { label: "Telnet", value: "telnet" },
    { label: "RDP", value: "rdp" },
    { label: "VNC", value: "vnc" },
    { label: "SFTP", value: "sftp" },
    { label: "FTP", value: "ftp" },
    { label: "FTPS", value: "ftps" }
];

const DetailsPage = ({name, setName, icon, setIcon, config, setConfig, fieldConfig, showNameIcon = true, overrides = [], onReset, inheritedConfig = {}}) => {
    const { t } = useTranslation();
    const [engines, setEngines] = useState([]);

    useEffect(() => {
        getRequest("engines").then(data => setEngines(data || [])).catch(() => {});
    }, []);

    const engineOptions = engines.map(e => ({
        label: `${e.name}${e.connected ? "" : " " + t("servers.dialog.engineOffline")}`,
        value: String(e.id),
    }));

    const showEngineSelect = engines.length > 1;
    const renderLabel = (field, children, htmlFor) => <label htmlFor={htmlFor}>{children}{Object.hasOwn(inheritedConfig, field) && !overrides.includes(field) && <span className="inherited-setting-marker" />}{overrides.includes(field) && <button type="button" className="inheritance-override" onClick={() => onReset(field)} title="Use inherited value"><Icon path={mdiContentDuplicate} size={0.65} /></button>}</label>;
    
    return (
        <>
            {showNameIcon && <div className="name-row">
                <div className="form-group">
                    <label htmlFor="name">{t("servers.dialog.fields.name")}</label>
                    <Input icon={mdiFormTextbox} type="text" placeholder={t("servers.dialog.placeholders.serverName")} 
                           id="name" autoComplete="off" value={name} setValue={setName} />
                </div>
                <div className="form-group">
                    <label>{t("servers.dialog.fields.icon")}</label>
                    <IconChooser selected={icon} setSelected={setIcon} />
                </div>
            </div>}

            {showEngineSelect && (
                <div className="form-group">
                    {renderLabel("engineId", t("servers.dialog.fields.engine"))}
                    <SelectBox
                        options={engineOptions}
                        selected={config.engineId ? String(config.engineId) : engineOptions[0]?.value}
                        setSelected={(value) => setConfig(prev => ({ ...prev, engineId: value }))}
                    />
                </div>
            )}
            
            {fieldConfig.showIpPort && (
                <>
                    <div className="address-row">
                        <div className="form-group">
                            {renderLabel("ip", t("servers.dialog.fields.serverIp"), "ip")}
                            <Input icon={mdiIp} type="text" placeholder={t("servers.dialog.placeholders.serverIp")} 
                                   id="ip" autoComplete="off" value={config.ip || ""} 
                                   setValue={(value) => setConfig(prev => ({ ...prev, ip: value }))} />
                        </div>
                        <div className="form-group">
                            {renderLabel("port", t("servers.dialog.fields.port"), "port")}
                            <input type="text" placeholder={t("servers.dialog.placeholders.port")} 
                                   value={config.port || ""} className="small-input" id="port"
                                   onChange={(e) => setConfig(prev => ({ ...prev, port: e.target.value }))} />
                        </div>
                    </div>
                    {fieldConfig.showProtocol && (
                        <div className="form-group">
                            {renderLabel("protocol", t("servers.dialog.fields.protocol"))}
                            <SelectBox options={PROTOCOL_OPTIONS} selected={config.protocol} 
                                       setSelected={(value) => setConfig(prev => ({ ...prev, protocol: value }))} />
                        </div>
                    )}
                    {config.wakeOnLanEnabled && (
                        <>
                            <div className="form-group">
                                {renderLabel("macAddress", t("servers.dialog.fields.macAddress"), "macAddress")}
                                <Input icon={mdiEthernet} type="text" placeholder={t("servers.dialog.placeholders.macAddress")}
                                       id="macAddress" autoComplete="off" value={config.macAddress || ""}
                                       setValue={(value) => setConfig(prev => ({ ...prev, macAddress: value }))} />
                            </div>
                            <div className="form-group">
                                {renderLabel("wolBroadcastAddress", t("servers.dialog.fields.wolBroadcastAddress"), "wolBroadcastAddress")}
                                <Input icon={mdiIp} type="text" placeholder={t("servers.dialog.placeholders.wolBroadcastAddress")}
                                       id="wolBroadcastAddress" autoComplete="off" value={config.wolBroadcastAddress || ""}
                                       setValue={(value) => setConfig(prev => ({ ...prev, wolBroadcastAddress: value }))} />
                            </div>
                        </>
                    )}
                </>
            )}
        </>
    );
}

export default DetailsPage;
