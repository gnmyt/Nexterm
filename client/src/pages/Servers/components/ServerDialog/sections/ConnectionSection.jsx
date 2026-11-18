import { useContext, useEffect, useMemo, useState } from "react";
import { mdiIp, mdiEthernet, mdiLanConnect, mdiNumeric, mdiClose, mdiPlus, mdiFormTextbox, mdiTimerOutline } from "@mdi/js";
import { useTranslation } from "react-i18next";
import Input from "@/common/components/IconInput";
import SelectBox from "@/common/components/SelectBox";
import Button from "@/common/components/Button";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import { SectionBlock } from "@/common/components/SectionedDialog";
import Field, { InheritanceReset, useInheritedClass } from "@/common/components/Field";
import { getRequest } from "@/common/utils/RequestUtil.js";

export const PROTOCOL_OPTIONS = [
    { label: "SSH", value: "ssh" },
    { label: "Telnet", value: "telnet" },
    { label: "RDP", value: "rdp" },
    { label: "VNC", value: "vnc" },
    { label: "SFTP", value: "sftp" },
    { label: "FTP", value: "ftp" },
    { label: "FTPS", value: "ftps" },
];

const collectSshServers = (entries, organizationId = null, out = []) => {
    entries.forEach(entry => {
        if (entry.type === "organization") collectSshServers(entry.entries || [], Number(String(entry.id).replace("org-", "")), out);
        else if (entry.type === "folder") collectSshServers(entry.entries || [], entry.organizationId ?? organizationId, out);
        else if (entry.type === "server" && entry.protocol === "ssh") out.push({ ...entry, organizationId: entry.organizationId ?? organizationId });
    });
    return out;
};

export const PortField = ({ config, setConfig }) => {
    const { t } = useTranslation();
    return (
        <Field label={t("servers.dialog.fields.port")} htmlFor="port" configKey="port">
            <Input icon={mdiNumeric} type="text" placeholder={t("servers.dialog.placeholders.port")} id="port"
                   autoComplete="off" value={config.port || ""} setValue={(value) => setConfig(prev => ({ ...prev, port: value }))} />
        </Field>
    );
};

const AddressFields = ({ config, setConfig }) => {
    const { t } = useTranslation();
    const update = (patch) => setConfig(prev => ({ ...prev, ...patch }));

    return (
        <>
            <div className="sd-row sd-row--address">
                <Field label={t("servers.dialog.fields.serverIp")} htmlFor="ip" configKey="ip">
                    <Input icon={mdiIp} type="text" placeholder={t("servers.dialog.placeholders.serverIp")} id="ip"
                           autoComplete="off" value={config.ip || ""} setValue={(value) => update({ ip: value })} />
                </Field>
                <PortField config={config} setConfig={setConfig} />
            </div>

            {config.wakeOnLanEnabled && (
                <div className="sd-row sd-row--split">
                    <Field label={t("servers.dialog.fields.macAddress")} htmlFor="macAddress" configKey="macAddress">
                        <Input icon={mdiEthernet} type="text" placeholder={t("servers.dialog.placeholders.macAddress")}
                               id="macAddress" autoComplete="off" value={config.macAddress || ""}
                               setValue={(value) => update({ macAddress: value })} />
                    </Field>
                    <Field label={t("servers.dialog.fields.wolBroadcastAddress")} htmlFor="wolBroadcastAddress" configKey="wolBroadcastAddress">
                        <Input icon={mdiIp} type="text" placeholder={t("servers.dialog.placeholders.wolBroadcastAddress")}
                               id="wolBroadcastAddress" autoComplete="off" value={config.wolBroadcastAddress || ""}
                               setValue={(value) => update({ wolBroadcastAddress: value })} />
                    </Field>
                </div>
            )}
        </>
    );
};

export const JumpHosts = ({ config, setConfig, isAllowed }) => {
    const { t } = useTranslation();
    const { servers } = useContext(ServerContext);
    const inheritedClass = useInheritedClass("jumpHosts");

    const jumpHosts = config.jumpHosts || [];
    const sshServers = useMemo(() => collectSshServers(servers || []).filter(server => !isAllowed || isAllowed(server)),
        [servers, isAllowed]);
    const setJumpHosts = (next) => setConfig(prev => ({ ...prev, jumpHosts: next }));

    const optionsFor = (index) => {
        const taken = jumpHosts.filter((_, i) => i !== index);
        return sshServers.filter(s => !taken.includes(s.id)).map(s => ({ label: `${s.name} (${s.ip})`, value: s.id }));
    };

    return (
        <div className={`sd-subsection${inheritedClass}`}>
            <div className="sd-subsection__header">
                <div>
                    <h4>{t("servers.dialog.settings.jumpHosts.title")}<InheritanceReset configKey="jumpHosts" /></h4>
                    <p>{t("servers.dialog.settings.jumpHosts.description")}</p>
                </div>
                {sshServers.length > jumpHosts.length && (
                    <Button type="secondary" size="small" icon={mdiPlus} text={t("servers.dialog.settings.jumpHosts.addButton")}
                            onClick={() => setJumpHosts([...jumpHosts, sshServers.find(s => !jumpHosts.includes(s.id)).id])} />
                )}
            </div>

            {jumpHosts.length > 0 && (
                <ol className="server-chain">
                    {jumpHosts.map((jumpHostId, index) => (
                        <li key={index} className="server-chain__item">
                            <span className="server-chain__index">{index + 1}</span>
                            <div className="server-chain__select">
                                <SelectBox options={optionsFor(index)} selected={jumpHostId}
                                           setSelected={(value) => setJumpHosts(jumpHosts.map((id, i) => i === index ? value : id))}
                                           searchable={sshServers.length > 5} />
                            </div>
                            <Button type="danger" icon={mdiClose} title={t("servers.dialog.settings.jumpHosts.removeTooltip")}
                                    onClick={() => setJumpHosts(jumpHosts.filter((_, i) => i !== index))} />
                        </li>
                    ))}
                </ol>
            )}

            {sshServers.length === 0 && <p className="sd-muted">{t("servers.dialog.settings.jumpHosts.noServersAvailable")}</p>}
        </div>
    );
};

export const usesSshCertificates = (protocol) => protocol === "ssh" || protocol === "sftp";

export const SshCertificateFields = ({ config, setConfig, organizationId }) => {
    const { t } = useTranslation();
    const [authorities, setAuthorities] = useState([]);
    const update = (patch) => setConfig(prev => ({ ...prev, ...patch }));

    useEffect(() => {
        getRequest("ssh-cas").then((list) => {
            setAuthorities((list || []).filter((authority) => authority.enabled !== false
                && (!authority.organizationId || Number(authority.organizationId) === Number(organizationId))));
        }).catch(() => setAuthorities([]));
    }, [organizationId]);

    const options = [
        { label: t("servers.dialog.settings.sshCertificate.none"), value: "" },
        ...authorities.map((authority) => ({ label: authority.name, value: String(authority.id) })),
    ];

    return (
        <div className="sd-subsection">
            <div className="sd-subsection__header">
                <div>
                    <h4>{t("servers.dialog.settings.sshCertificate.title")}</h4>
                    <p>{t("servers.dialog.settings.sshCertificate.description")}</p>
                </div>
            </div>
            <Field label={t("servers.dialog.settings.sshCertificate.authority")} configKey="sshCaId">
                <SelectBox options={options} selected={config.sshCaId ? String(config.sshCaId) : ""}
                           setSelected={(value) => update({ sshCaId: value ? Number(value) : null })} />
            </Field>
            <div className="sd-row sd-row--split">
                <Field label={t("servers.dialog.settings.sshCertificate.domain")} htmlFor="ssh-domain" configKey="domain">
                    <Input icon={mdiFormTextbox} id="ssh-domain" autoComplete="off" value={config.domain || ""}
                           setValue={(value) => update({ domain: value })} />
                </Field>
                <Field label={t("servers.dialog.settings.sshCertificate.environment")} htmlFor="ssh-environment" configKey="environment">
                    <Input icon={mdiFormTextbox} id="ssh-environment" autoComplete="off" value={config.environment || ""}
                           setValue={(value) => update({ environment: value })} />
                </Field>
            </div>
            <Field label={t("servers.dialog.settings.sshCertificate.ttl")} htmlFor="ssh-ttl" configKey="sshCertTtl">
                <Input icon={mdiTimerOutline} id="ssh-ttl" type="number" autoComplete="off" value={config.sshCertTtl ? String(config.sshCertTtl) : ""}
                       setValue={(value) => update({ sshCertTtl: value ? Number(value) : null })} />
            </Field>
        </div>
    );
};

const ConnectionSection = ({ config, setConfig, fieldConfig, editServerId, organizationId }) => {
    const { t } = useTranslation();
    const notSelf = useMemo(() => (server) => server.id !== editServerId, [editServerId]);

    return (
        <SectionBlock id="connection" icon={mdiLanConnect} title={t("servers.dialog.sections.connection")}>
            <AddressFields config={config} setConfig={setConfig} />

            {fieldConfig.showProtocol && (
                <Field label={t("servers.dialog.fields.protocol")} configKey="protocol">
                    <SelectBox options={PROTOCOL_OPTIONS} selected={config.protocol}
                               setSelected={(value) => setConfig(prev => ({ ...prev, protocol: value }))} />
                </Field>
            )}

            {config.protocol === "ssh" && <JumpHosts config={config} setConfig={setConfig} isAllowed={notSelf} />}
            {usesSshCertificates(config.protocol) && <SshCertificateFields config={config} setConfig={setConfig} organizationId={organizationId} />}
        </SectionBlock>
    );
};

export default ConnectionSection;
