import { DialogProvider } from "@/common/components/Dialog";
import "./styles.sass";
import { useContext, useEffect, useState } from "react";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import IconInput from "@/common/components/IconInput";
import { mdiAccountCircleOutline, mdiFormTextbox, mdiIp, mdiLockOutline, mdiServerNetwork } from "@mdi/js";
import Button from "@/common/components/Button";
import Input from "@/common/components/IconInput";
import { getRequest, patchRequest, postRequest, putRequest } from "@/common/utils/RequestUtil.js";
import { useTranslation } from "react-i18next";

export const ProxmoxDialog = ({ open, onClose, currentFolderId, editServerId }) => {
    const { t } = useTranslation();

    const [name, setName] = useState("");
    const [ip, setIp] = useState("");
    const [port, setPort] = useState("8006");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [nodeName, setNodeName] = useState("");

    const create = () => {
        putRequest("integrations", {
            name, folderId: currentFolderId, ip, port, username, password,
        }).then(async () => {
            onClose();
            loadServers();
        }).catch(err => console.error(err));
    };

    const edit = () => {
        patchRequest(`integrations/${editServerId.split("-")[1]}`, {
            name, ip, port, username, password: password === "********" ? undefined : password,
            nodeName: nodeName || null,
        }).then(async () => {
            onClose();
            loadServers();
        }).catch(err => console.error(err));
    }

    useEffect(() => {
        if (editServerId && open) {
            getRequest(`integrations/${editServerId.split("-")[1]}`).then(server => {
                setName(server.name);
                setIp(server.ip);
                setPort(server.port);
                setUsername(server.username);
                setPassword("********");
                setNodeName(server.nodeName || "");
            }).catch(err => console.error(err));
        } else {
            setName("");
            setIp("");
            setPort("8006");
            setUsername("");
            setPassword("");
            setNodeName("");
        }
    }, [editServerId, open]);

    const { loadServers } = useContext(ServerContext);

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="proxmox-dialog">
                <h2>{editServerId ? t("servers.proxmoxDialog.title.edit") : t("servers.proxmoxDialog.title.import")}</h2>
                <div className="form-group">
                    <label htmlFor="name">{t("servers.proxmoxDialog.fields.name")}</label>
                    <IconInput icon={mdiFormTextbox} value={name} setValue={setName} placeholder={t("servers.proxmoxDialog.placeholders.name")} id="name" />
                </div>

                <div className="ip-row">

                    <div className="form-group">
                        <label htmlFor="ip">{t("servers.proxmoxDialog.fields.serverIp")}</label>
                        <Input icon={mdiIp} type="text" placeholder={t("servers.proxmoxDialog.placeholders.serverIp")} id="ip"
                               autoComplete="off" value={ip} setValue={setIp} />
                    </div>

                    <div className="form-group">
                        <label htmlFor="port">{t("servers.proxmoxDialog.fields.port")}</label>
                        <input type="text" placeholder={t("servers.proxmoxDialog.placeholders.port")} value={port}
                               onChange={(event) => setPort(event.target.value)}
                               className="small-input" id="port" />
                    </div>
                </div>

                <div className="form-group">
                    <label htmlFor="username">{t("servers.proxmoxDialog.fields.username")}</label>
                    <IconInput icon={mdiAccountCircleOutline} value={username} setValue={setUsername}
                               placeholder={t("servers.proxmoxDialog.placeholders.username")} id="username" />
                </div>

                <div className="form-group">
                    <label htmlFor="password">{t("servers.proxmoxDialog.fields.password")}</label>
                    <IconInput icon={mdiLockOutline} value={password} setValue={setPassword} placeholder={t("servers.proxmoxDialog.placeholders.password")}
                               type="password" id="password" />
                </div>

                {editServerId && (
                    <div className="form-group">
                        <label htmlFor="nodeName">{t("servers.proxmoxDialog.fields.nodeName")}</label>
                        <IconInput icon={mdiServerNetwork} value={nodeName} setValue={setNodeName} 
                                   placeholder={t("servers.proxmoxDialog.placeholders.specificNode")} id="nodeName" />
                    </div>
                )}

                <Button onClick={editServerId ? edit : create} text={editServerId ? t("servers.proxmoxDialog.actions.edit") : t("servers.proxmoxDialog.actions.import")} />

            </div>
        </DialogProvider>
    );
};