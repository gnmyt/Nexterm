import { mdiDebian, mdiFormTextbox, mdiIp, mdiLinux, mdiMicrosoftWindows, mdiServerOutline } from "@mdi/js";
import Input from "@/common/components/IconInput";
import Icon from "@mdi/react";
import SelectBox from "@/common/components/SelectBox";

const DetailsPage = ({name, setName, icon, setIcon, ip, setIp, port, setPort, protocol, setProtocol}) => {
    return (
        <>
            <div className="name-row">

                <div className="form-group">
                    <label htmlFor="name">Name</label>
                    <Input icon={mdiFormTextbox} type="text" placeholder="Server name" id="name"
                           autoComplete="off" value={name} setValue={setName} />
                </div>

                <div className="form-group">
                    <label>Icon</label>
                    <SelectBox options={[
                        { label: <Icon path={mdiServerOutline} size={1} />, value: "server" },
                        { label: <Icon path={mdiMicrosoftWindows} size={1} />, value: "windows" },
                        { label: <Icon path={mdiLinux} size={1} />, value: "linux" },
                        { label: <Icon path={mdiDebian} size={1} />, value: "debian" },
                    ]} selected={icon} setSelected={setIcon} />
                </div>

            </div>
            <div className="address-row">
                <div className="form-group">
                    <label htmlFor="ip">Server-IP</label>
                    <Input icon={mdiIp} type="text" placeholder="Server-IP" id="ip"
                           autoComplete="off" value={ip} setValue={setIp} />
                </div>
                <div className="form-group">
                    <label htmlFor="port">Port</label>
                    <input type="text" placeholder="Port" value={port} onChange={(event) => setPort(event.target.value)}
                            className="small-input" id="port" />
                </div>

                <div className="form-group">
                    <label>Protocol</label>
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