import { DialogProvider } from "@/common/components/Dialog";
import "./styles.sass";
import { useContext, useEffect, useState } from "react";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import IconInput from "@/common/components/IconInput";
import { mdiAccountCircleOutline, mdiChartLine, mdiFormTextbox, mdiIp, mdiLockOutline, mdiServerNetwork } from "@mdi/js";
import Button from "@/common/components/Button";
import Input from "@/common/components/IconInput";
import { getRequest, patchRequest, putRequest } from "@/common/utils/RequestUtil.js";
import { useTranslation } from "react-i18next";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import ToggleSwitch from "@/common/components/ToggleSwitch";
import Icon from "@mdi/react";

export const ProxmoxDialog = ({ open, onClose, currentFolderId, currentOrganizationId, editServerId }) => {
    const { t } = useTranslation();
    const { sendToast } = useToast();

    const [name, setName] = useState("");
    const [ip, setIp] = useState("");
    const [port, setPort] = useState("8006");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [monitoringEnabled, setMonitoringEnabled] = useState(false);
    const [loading, setLoading] = useState(false);

    const create = () => {
        setLoading(true);
        putRequest("integrations", {
            name, folderId: currentFolderId, organizationId: currentOrganizationId, ip, port, username, password, monitoringEnabled,
        }).then(async (response) => {
            if (response.code) {
                sendToast("Error", response.message);
                setLoading(false);
                return;
            }
            sendToast("Success", t("servers.proxmoxDialog.messages.created"));
            onClose();
            loadServers();
            setLoading(false);
        }).catch(err => {
            sendToast("Error", err.message || t("servers.proxmoxDialog.messages.createFailed"));
            console.error(err);
            setLoading(false);
        });
    };

    const edit = () => {
        setLoading(true);
        patchRequest(`integrations/${editServerId}`, {
            name, ip, port, username, password: password === "********" ? undefined : password, monitoringEnabled,
        }).then(async (response) => {
            if (response.code) {
                sendToast("Error", response.message);
                setLoading(false);
                return;
            }
            sendToast("Success", t("servers.proxmoxDialog.messages.updated"));
            onClose();
            loadServers();
            setLoading(false);
        }).catch(err => {
            sendToast("Error", err.message || t("servers.proxmoxDialog.messages.updateFailed"));
            console.error(err);
            setLoading(false);
        });
    }

    useEffect(() => {
        if (editServerId && open) {
            getRequest(`integrations/${editServerId}`).then(server => {
                setName(server.name);
                setIp(server.ip);
                setPort(server.port);
                setUsername(server.username);
                setPassword("********");
                setMonitoringEnabled(server.monitoringEnabled || false);
            }).catch(err => console.error(err));
        } else {
            setName("");
            setIp("");
            setPort("8006");
            setUsername("");
            setPassword("");
            setMonitoringEnabled(false);
        }
        setLoading(false);
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

                <div className="settings-toggle">
                    <div className="settings-toggle-info">
                        <span className="settings-toggle-label">
                            <Icon path={mdiChartLine} size={0.8} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                            {t('servers.proxmoxDialog.fields.monitoring')}
                        </span>
                        <span className="settings-toggle-description">
                            {t('servers.proxmoxDialog.monitoringDescription')}
                        </span>
                    </div>
                    <ToggleSwitch checked={monitoringEnabled} onChange={setMonitoringEnabled} id="pve-monitoring-toggle" />
                </div>

                <Button onClick={editServerId ? edit : create} text={editServerId ? t("servers.proxmoxDialog.actions.edit") : t("servers.proxmoxDialog.actions.import")} disabled={loading} />

            </div>
        </DialogProvider>
    );
};