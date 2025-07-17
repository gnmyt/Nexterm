import { 
    mdiDebian, 
    mdiFormTextbox, 
    mdiIp, 
    mdiLinux, 
    mdiMicrosoftWindows, 
    mdiServerOutline,
    mdiUbuntu,
    mdiApple,
    mdiDocker,
    mdiKubernetes,
    mdiDatabase,
    mdiCloud,
    mdiRaspberryPi,
    mdiConsole,
    mdiMonitor,
    mdiCube,
    mdiFreebsd
} from "@mdi/js";
import Input from "@/common/components/IconInput";
import Icon from "@mdi/react";
import SelectBox from "@/common/components/SelectBox";
import { useTranslation } from "react-i18next";

const DetailsPage = ({name, setName, icon, setIcon, ip, setIp, port, setPort, protocol, setProtocol}) => {
    const { t } = useTranslation();
    
    return (
        <>
            <div className="name-row">

                <div className="form-group">
                    <label htmlFor="name">{t("servers.dialog.fields.name")}</label>
                    <Input icon={mdiFormTextbox} type="text" placeholder={t("servers.dialog.placeholders.serverName")} id="name"
                           autoComplete="off" value={name} setValue={setName} />
                </div>

                <div className="form-group">
                    <label>{t("servers.dialog.fields.icon")}</label>
                    <SelectBox options={[
                        { label: <Icon path={mdiServerOutline} size={1} />, value: "server" },
                        { label: <Icon path={mdiMicrosoftWindows} size={1} />, value: "windows" },
                        { label: <Icon path={mdiLinux} size={1} />, value: "linux" },
                        { label: <Icon path={mdiDebian} size={1} />, value: "debian" },
                        { label: <Icon path={mdiUbuntu} size={1} />, value: "ubuntu" },
                        { label: <Icon path={mdiLinux} size={1} />, value: "arch" },
                        { label: <Icon path={mdiFreebsd} size={1} />, value: "freebsd" },
                        { label: <Icon path={mdiApple} size={1} />, value: "macos" },
                        { label: <Icon path={mdiDocker} size={1} />, value: "docker" },
                        { label: <Icon path={mdiKubernetes} size={1} />, value: "kubernetes" },
                        { label: <Icon path={mdiDatabase} size={1} />, value: "database" },
                        { label: <Icon path={mdiCloud} size={1} />, value: "cloud" },
                        { label: <Icon path={mdiRaspberryPi} size={1} />, value: "raspberry" },
                        { label: <Icon path={mdiConsole} size={1} />, value: "terminal" },
                        { label: <Icon path={mdiMonitor} size={1} />, value: "desktop" },
                        { label: <Icon path={mdiCube} size={1} />, value: "vm" },
                    ]} selected={icon} setSelected={setIcon} />
                </div>

            </div>
            <div className="address-row">
                <div className="form-group">
                    <label htmlFor="ip">{t("servers.dialog.fields.serverIp")}</label>
                    <Input icon={mdiIp} type="text" placeholder={t("servers.dialog.placeholders.serverIp")} id="ip"
                           autoComplete="off" value={ip} setValue={setIp} />
                </div>
                <div className="form-group">
                    <label htmlFor="port">{t("servers.dialog.fields.port")}</label>
                    <input type="text" placeholder={t("servers.dialog.placeholders.port")} value={port} onChange={(event) => setPort(event.target.value)}
                            className="small-input" id="port" />
                </div>

                <div className="form-group">
                    <label>{t("servers.dialog.fields.protocol")}</label>
                    <SelectBox options={[
                        { label: "SSH", value: "ssh" },
                        { label: "RDP", value: "rdp" },
                        { label: "VNC", value: "vnc" }
                    ]} selected={protocol} setSelected={setProtocol} />
                </div>

            </div>
        </>
    );
}

export default DetailsPage;