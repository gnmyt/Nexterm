import { mdiFormTextbox, mdiIp, mdiEthernet } from "@mdi/js";
import Input from "@/common/components/IconInput";
import SelectBox from "@/common/components/SelectBox";
import IconChooser from "../components/IconChooser";
import { useTranslation } from "react-i18next";

const PROTOCOL_OPTIONS = [
    { label: "SSH", value: "ssh" },
    { label: "Telnet", value: "telnet" },
    { label: "RDP", value: "rdp" },
    { label: "VNC", value: "vnc" }
];

const DetailsPage = ({name, setName, icon, setIcon, config, setConfig, fieldConfig}) => {
    const { t } = useTranslation();
    
    return (
        <>
            <div className="name-row">
                <div className="form-group">
                    <label htmlFor="name">{t("servers.dialog.fields.name")}</label>
                    <Input icon={mdiFormTextbox} type="text" placeholder={t("servers.dialog.placeholders.serverName")} 
                           id="name" autoComplete="off" value={name} setValue={setName} />
                </div>
                <div className="form-group">
                    <label>{t("servers.dialog.fields.icon")}</label>
                    <IconChooser selected={icon} setSelected={setIcon} />
                </div>
            </div>
            
            {fieldConfig.showIpPort && (
                <>
                    <div className="address-row">
                        <div className="form-group">
                            <label htmlFor="ip">{t("servers.dialog.fields.serverIp")}</label>
                            <Input icon={mdiIp} type="text" placeholder={t("servers.dialog.placeholders.serverIp")} 
                                   id="ip" autoComplete="off" value={config.ip || ""} 
                                   setValue={(value) => setConfig(prev => ({ ...prev, ip: value }))} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="port">{t("servers.dialog.fields.port")}</label>
                            <input type="text" placeholder={t("servers.dialog.placeholders.port")} 
                                   value={config.port || ""} className="small-input" id="port"
                                   onChange={(e) => setConfig(prev => ({ ...prev, port: e.target.value }))} />
                        </div>
                    </div>
                    {fieldConfig.showProtocol && (
                        <div className="form-group">
                            <label>{t("servers.dialog.fields.protocol")}</label>
                            <SelectBox options={PROTOCOL_OPTIONS} selected={config.protocol} 
                                       setSelected={(value) => setConfig(prev => ({ ...prev, protocol: value }))} />
                        </div>
                    )}
                    {config.wakeOnLanEnabled && (
                        <div className="form-group">
                            <label htmlFor="macAddress">{t("servers.dialog.fields.macAddress")}</label>
                            <Input icon={mdiEthernet} type="text" placeholder={t("servers.dialog.placeholders.macAddress")} 
                                   id="macAddress" autoComplete="off" value={config.macAddress || ""} 
                                   setValue={(value) => setConfig(prev => ({ ...prev, macAddress: value }))} />
                        </div>
                    )}
                </>
            )}

            {fieldConfig.showPveConfig && fieldConfig.pveFields && (
                <div className="pve-config-row">
                    {fieldConfig.pveFields.includes("nodeName") && (
                        <div className="form-group">
                            <label htmlFor="nodeName">{t("servers.dialog.fields.nodeName")}</label>
                            <Input icon={mdiIp} type="text" placeholder={t("servers.dialog.placeholders.nodeName")} 
                                   id="nodeName" autoComplete="off" value={config.nodeName || ""} 
                                   setValue={(value) => setConfig(prev => ({ ...prev, nodeName: value }))} />
                        </div>
                    )}
                    {fieldConfig.pveFields.includes("vmid") && (
                        <div className="form-group">
                            <label htmlFor="vmid">{t("servers.dialog.fields.vmid")}</label>
                            <input type="text" placeholder={t("servers.dialog.placeholders.vmid")} 
                                   value={config.vmid || ""} className="small-input" id="vmid"
                                   onChange={(e) => setConfig(prev => ({ ...prev, vmid: e.target.value }))} />
                        </div>
                    )}
                </div>
            )}
        </>
    );
}

export default DetailsPage;