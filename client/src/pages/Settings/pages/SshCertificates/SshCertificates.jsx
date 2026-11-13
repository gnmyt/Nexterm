import "./styles.sass";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { deleteRequest, getRequest, patchRequest, postRequest } from "@/common/utils/RequestUtil.js";
import Button from "@/common/components/Button";
import Input from "@/common/components/IconInput";
import SelectBox from "@/common/components/SelectBox";
import ToggleSwitch from "@/common/components/ToggleSwitch";
import { DialogProvider } from "@/common/components/Dialog";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import Icon from "@mdi/react";
import { mdiPencil, mdiPlus, mdiTrashCan, mdiShieldKeyOutline, mdiFormTextbox, mdiTimerOutline } from "@mdi/js";

const emptyForm = () => ({
    name: "",
    organizationId: "",
    backend: "local",
    enabled: true,
    ttlSeconds: "300",
    sourceAddress: "",
    extraPrincipals: "",
    groupMappings: "",
    selectorGroups: "",
    domains: "",
    environments: "",
    ttlByGroup: "",
    ttlByEnvironment: "",
    keyIdTemplate: "{{username}}",
    provisioner: "",
    address: "",
    mount: "ssh",
    role: "",
    namespace: "",
    url: "",
    tokenMode: "ott",
    secret: "",
});

const formatMappings = (mappings) => (mappings || []).map((mapping) => `${mapping.group}=${(mapping.principals || []).join(",")}`).join("\n");
const formatTtl = (items, key) => (items || []).map((item) => `${item[key]}=${item.ttlSeconds}`).join("\n");

const parseList = (value) => String(value || "").split(",").map((item) => item.trim()).filter(Boolean);

const parseMappings = (value) => String(value || "").split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const separator = line.indexOf("=");
    if (separator <= 0) throw new Error(line);
    return {
        group: line.slice(0, separator).trim(),
        principals: parseList(line.slice(separator + 1)),
    };
});

const authorityConfig = (form) => {
    if (form.backend === "vault") {
        return { address: form.address.trim(), mount: form.mount.trim(), role: form.role.trim(), namespace: form.namespace.trim() };
    }
    if (form.backend === "step") {
        return { url: form.url.trim(), tokenMode: form.tokenMode, provisioner: form.provisioner.trim() };
    }
    if (form.backend === "webhook") return { url: form.url.trim() };
    return {};
};

const formFromAuthority = (authority) => ({
    ...emptyForm(),
    name: authority.name || "",
    organizationId: authority.organizationId ? String(authority.organizationId) : "",
    backend: authority.backend || "local",
    enabled: authority.enabled !== false,
    ttlSeconds: String(authority.ttlSeconds || 300),
    sourceAddress: authority.sourceAddress || "",
    extraPrincipals: (authority.extraPrincipals || []).join(", "),
    groupMappings: formatMappings(authority.groupPrincipalMappings),
    selectorGroups: (authority.selectorGroups || []).join(", "),
    domains: (authority.domains || []).join(", "),
    environments: (authority.environments || []).join(", "),
    ttlByGroup: formatTtl(authority.ttlByGroup, "group"),
    ttlByEnvironment: formatTtl(authority.ttlByEnvironment, "environment"),
    keyIdTemplate: authority.keyIdTemplate || "{{username}}",
    provisioner: authority.config?.provisioner || "",
    address: authority.config?.address || "",
    mount: authority.config?.mount || "ssh",
    role: authority.config?.role || "",
    namespace: authority.config?.namespace || "",
    url: authority.config?.url || "",
    tokenMode: authority.config?.tokenMode || "ott",
    secret: "",
});

export const SshCertificates = () => {
    const { t } = useTranslation();
    const { sendToast } = useToast();
    const [authorities, setAuthorities] = useState([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm());
    const [saving, setSaving] = useState(false);
    const [removeTarget, setRemoveTarget] = useState(null);
    const [organizations, setOrganizations] = useState([]);

    const load = async () => {
        try {
            const [authorityList, organizationList] = await Promise.all([
                getRequest("ssh-cas"),
                getRequest("organizations").catch(() => []),
            ]);
            setAuthorities(authorityList);
            setOrganizations(organizationList || []);
        } catch (error) {
            sendToast("Error", error.message || t("settings.sshCertificates.loadFailed"));
        }
    };

    useEffect(() => { void load(); }, []);

    const update = (field) => (value) => setForm((current) => ({ ...current, [field]: value }));

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm());
        setDialogOpen(true);
    };

    const openEdit = (authority) => {
        setEditing(authority);
        setForm(formFromAuthority(authority));
        setDialogOpen(true);
    };

    const save = async (event) => {
        event.preventDefault();
        let groupPrincipalMappings = [];
        let ttlByGroup = [];
        let ttlByEnvironment = [];
        try {
            groupPrincipalMappings = parseMappings(form.groupMappings);
            ttlByGroup = String(form.ttlByGroup || "").split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
                const separator = line.indexOf("=");
                if (separator <= 0) throw new Error(line);
                return { group: line.slice(0, separator).trim(), ttlSeconds: Number(line.slice(separator + 1)) };
            });
            ttlByEnvironment = String(form.ttlByEnvironment || "").split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
                const separator = line.indexOf("=");
                if (separator <= 0) throw new Error(line);
                return { environment: line.slice(0, separator).trim(), ttlSeconds: Number(line.slice(separator + 1)) };
            });
        } catch {
            sendToast("Error", t("settings.sshCertificates.mappingInvalid"));
            return;
        }

        const payload = {
            name: form.name.trim(),
            organizationId: form.organizationId ? Number(form.organizationId) : null,
            backend: form.backend,
            enabled: form.enabled,
            ttlSeconds: Number(form.ttlSeconds),
            sourceAddress: form.sourceAddress.trim(),
            extraPrincipals: parseList(form.extraPrincipals),
            groupPrincipalMappings,
            selectorGroups: parseList(form.selectorGroups),
            domains: parseList(form.domains),
            environments: parseList(form.environments),
            ttlByGroup,
            ttlByEnvironment,
            keyIdTemplate: form.keyIdTemplate.trim() || "{{username}}",
            config: authorityConfig(form),
        };
        if (form.secret.trim()) payload.secret = form.secret;

        setSaving(true);
        try {
            if (editing) await patchRequest(`ssh-cas/${editing.id}`, payload);
            else await postRequest("ssh-cas", payload);
            setDialogOpen(false);
            await load();
            sendToast("Success", t(editing ? "settings.sshCertificates.updated" : "settings.sshCertificates.created"));
        } catch (error) {
            sendToast("Error", error.message || t("settings.sshCertificates.saveFailed"));
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        try {
            await deleteRequest(`ssh-cas/${removeTarget.id}`);
            setRemoveTarget(null);
            await load();
        } catch (error) {
            sendToast("Error", error.message || t("settings.sshCertificates.saveFailed"));
        }
    };

    return (
        <div className="ssh-ca-page">
            <div className="section-header">
                <div>
                    <h2>{t("settings.sshCertificates.title")}</h2>
                    <p>{t("settings.sshCertificates.description")}</p>
                </div>
                <Button text={t("settings.sshCertificates.add")} icon={mdiPlus} onClick={openCreate} />
            </div>

            <div className="ca-list">
                {authorities.length === 0 && <p>{t("settings.sshCertificates.empty")}</p>}
                {authorities.map((authority) => (
                    <div className="ca-card" key={authority.id}>
                        <div>
                            <h3>{authority.name}</h3>
                            <p>{t(`settings.sshCertificates.backends.${authority.backend}`)} · {authority.ttlSeconds}s{authority.enabled ? "" : ` · ${t("settings.sshCertificates.disabled")}`}</p>
                            {authority.config?.publicKey && <p>{authority.config.publicKey}</p>}
                        </div>
                        <div className="ca-actions">
                            <button type="button" onClick={() => openEdit(authority)} aria-label={t("settings.sshCertificates.edit")}><Icon path={mdiPencil} size={0.8} /></button>
                            <button type="button" onClick={() => setRemoveTarget(authority)} aria-label={t("settings.sshCertificates.delete")}><Icon path={mdiTrashCan} size={0.8} /></button>
                        </div>
                    </div>
                ))}
            </div>

            <DialogProvider open={dialogOpen} onClose={() => setDialogOpen(false)}>
                <form className="ssh-ca-dialog" onSubmit={save}>
                    <div className="dialog-title"><Icon path={mdiShieldKeyOutline} /><h2>{editing ? t("settings.sshCertificates.edit") : t("settings.sshCertificates.add")}</h2></div>
                    <div className="form-group">
                        <label htmlFor="ca-name">{t("settings.sshCertificates.fields.name")}</label>
                        <Input id="ca-name" icon={mdiFormTextbox} value={form.name} setValue={update("name")} required />
                    </div>
                    <div className="form-group">
                        <label>{t("settings.sshCertificates.fields.organization")}</label>
                        <SelectBox selected={form.organizationId} setSelected={update("organizationId")} options={[
                            { label: t("settings.sshCertificates.fields.allOrganizations"), value: "" },
                            ...organizations.map((organization) => ({ label: organization.name, value: String(organization.id) })),
                        ]} />
                    </div>
                    <div className="form-group">
                        <label>{t("settings.sshCertificates.fields.backend")}</label>
                        <SelectBox selected={form.backend} setSelected={update("backend")} options={[
                            { label: t("settings.sshCertificates.backends.local"), value: "local" },
                            { label: t("settings.sshCertificates.backends.vault"), value: "vault" },
                            { label: t("settings.sshCertificates.backends.step"), value: "step" },
                            { label: t("settings.sshCertificates.backends.webhook"), value: "webhook" },
                        ]} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="ca-ttl">{t("settings.sshCertificates.fields.ttl")}</label>
                        <Input id="ca-ttl" icon={mdiTimerOutline} value={form.ttlSeconds} setValue={update("ttlSeconds")} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="ca-source">{t("settings.sshCertificates.fields.sourceAddress")}</label>
                        <Input id="ca-source" icon={mdiFormTextbox} value={form.sourceAddress} setValue={update("sourceAddress")} placeholder={t("settings.sshCertificates.fields.sourceAddressPlaceholder")} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="ca-extra">{t("settings.sshCertificates.fields.extraPrincipals")}</label>
                        <Input id="ca-extra" icon={mdiFormTextbox} value={form.extraPrincipals} setValue={update("extraPrincipals")} placeholder="ubuntu, admin" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="ca-groups">{t("settings.sshCertificates.fields.groupMappings")}</label>
                        <textarea id="ca-groups" value={form.groupMappings} onChange={(event) => update("groupMappings")(event.target.value)} placeholder={"linux-admins=root,ubuntu"} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="ca-selector">{t("settings.sshCertificates.fields.selectorGroups")}</label>
                        <Input id="ca-selector" icon={mdiFormTextbox} value={form.selectorGroups} setValue={update("selectorGroups")} placeholder="linux-admins, dba" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="ca-domains">{t("settings.sshCertificates.fields.domains")}</label>
                        <Input id="ca-domains" icon={mdiFormTextbox} value={form.domains} setValue={update("domains")} placeholder="corp.example" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="ca-environments">{t("settings.sshCertificates.fields.environments")}</label>
                        <Input id="ca-environments" icon={mdiFormTextbox} value={form.environments} setValue={update("environments")} placeholder="production" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="ca-ttl-group">{t("settings.sshCertificates.fields.ttlByGroup")}</label>
                        <textarea id="ca-ttl-group" value={form.ttlByGroup} onChange={(event) => update("ttlByGroup")(event.target.value)} placeholder={"linux-admins=900"} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="ca-ttl-env">{t("settings.sshCertificates.fields.ttlByEnvironment")}</label>
                        <textarea id="ca-ttl-env" value={form.ttlByEnvironment} onChange={(event) => update("ttlByEnvironment")(event.target.value)} placeholder={"production=300"} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="ca-keyid">{t("settings.sshCertificates.fields.keyId")}</label>
                        <Input id="ca-keyid" icon={mdiFormTextbox} value={form.keyIdTemplate} setValue={update("keyIdTemplate")} />
                    </div>
                    {form.backend === "vault" && (
                        <>
                            <div className="form-group"><label htmlFor="ca-address">{t("settings.sshCertificates.fields.address")}</label><Input id="ca-address" icon={mdiFormTextbox} value={form.address} setValue={update("address")} /></div>
                            <div className="form-group"><label htmlFor="ca-mount">{t("settings.sshCertificates.fields.mount")}</label><Input id="ca-mount" icon={mdiFormTextbox} value={form.mount} setValue={update("mount")} /></div>
                            <div className="form-group"><label htmlFor="ca-role">{t("settings.sshCertificates.fields.role")}</label><Input id="ca-role" icon={mdiFormTextbox} value={form.role} setValue={update("role")} /></div>
                        </>
                    )}
                    {(form.backend === "step" || form.backend === "webhook") && (
                        <div className="form-group"><label htmlFor="ca-url">{t("settings.sshCertificates.fields.url")}</label><Input id="ca-url" icon={mdiFormTextbox} value={form.url} setValue={update("url")} /></div>
                    )}
                    {form.backend === "step" && (
                        <div className="form-group">
                            <label>{t("settings.sshCertificates.fields.tokenMode")}</label>
                            <SelectBox selected={form.tokenMode} setSelected={update("tokenMode")} options={[
                                { label: t("settings.sshCertificates.tokenModes.ott"), value: "ott" },
                                { label: t("settings.sshCertificates.tokenModes.bearer"), value: "bearer" },
                                { label: t("settings.sshCertificates.tokenModes.provisioner"), value: "provisioner" },
                            ]} />
                        </div>
                    )}
                    {form.backend === "step" && form.tokenMode === "provisioner" && (
                        <div className="form-group">
                            <label htmlFor="ca-provisioner">{t("settings.sshCertificates.fields.provisioner")}</label>
                            <Input id="ca-provisioner" icon={mdiFormTextbox} value={form.provisioner} setValue={update("provisioner")} />
                        </div>
                    )}
                    <div className="form-group">
                        <label htmlFor="ca-secret">{form.backend === "local" || form.tokenMode === "provisioner" ? t("settings.sshCertificates.fields.caKey") : t("settings.sshCertificates.fields.token")}</label>
                        <textarea id="ca-secret" value={form.secret} onChange={(event) => update("secret")(event.target.value)} placeholder={editing ? t("settings.sshCertificates.fields.secretKeep") : ""} />
                    </div>
                    <div className="toggle-row">
                        <label htmlFor="ca-enabled">{t("settings.sshCertificates.fields.enabled")}</label>
                        <ToggleSwitch id="ca-enabled" checked={form.enabled} onChange={update("enabled")} />
                    </div>
                    <div className="dialog-actions">
                        <Button text={t("settings.sshCertificates.cancel")} type="secondary" buttonType="button" onClick={() => setDialogOpen(false)} />
                        <Button text={t("settings.sshCertificates.save")} buttonType="submit" disabled={saving} />
                    </div>
                </form>
            </DialogProvider>

            <ActionConfirmDialog
                open={!!removeTarget}
                setOpen={(open) => { if (!open) setRemoveTarget(null); }}
                onConfirm={remove}
                text={t("settings.sshCertificates.deleteConfirm", { name: removeTarget?.name || "" })}
            />
        </div>
    );
};
