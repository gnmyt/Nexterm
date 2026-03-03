import { DialogProvider } from "@/common/components/Dialog";
import "./styles.sass";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Input from "@/common/components/IconInput";
import { mdiAccountMultiple, mdiCog, mdiFormTextbox, mdiKey, mdiServer, mdiNumeric, mdiFilter, mdiTestTube } from "@mdi/js";
import Button from "@/common/components/Button";
import ToggleSwitch from "@/common/components/ToggleSwitch";
import { patchRequest, postRequest, putRequest } from "@/common/utils/RequestUtil.js";
import { useToast } from "@/common/contexts/ToastContext.jsx";

const defaults = { name: "", host: "", port: "389", bindDN: "", bindPassword: "", baseDN: "", userSearchFilter: "(uid={{username}})", useTLS: false, usernameAttr: "uid", firstNameAttr: "givenName", lastNameAttr: "sn" };

export const LDAPProviderDialog = ({ open, onClose, provider, onSave }) => {
    const { t } = useTranslation();
    const { sendToast } = useToast();
    const [form, setForm] = useState(defaults);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [testing, setTesting] = useState(false);

    const set = (key) => (val) => setForm(f => ({ ...f, [key]: val }));
    const T = (key) => t(`settings.authentication.ldapDialog.${key}`);

    useEffect(() => {
        if (provider) {
            setForm({
                name: provider.name, host: provider.host, port: String(provider.port), bindDN: provider.bindDN,
                bindPassword: "********", baseDN: provider.baseDN, userSearchFilter: provider.userSearchFilter,
                useTLS: Boolean(provider.useTLS), usernameAttr: provider.usernameAttribute,
                firstNameAttr: provider.firstNameAttribute, lastNameAttr: provider.lastNameAttribute,
            });
        } else setForm(defaults);
        setShowAdvanced(false);
    }, [provider, open]);

    const handleSubmit = async () => {
        try {
            const data = {
                name: form.name, host: form.host, port: parseInt(form.port), bindDN: form.bindDN, baseDN: form.baseDN,
                userSearchFilter: form.userSearchFilter, useTLS: Boolean(form.useTLS), usernameAttribute: form.usernameAttr,
                firstNameAttribute: form.firstNameAttr, lastNameAttribute: form.lastNameAttr,
                ...(form.bindPassword !== "********" && { bindPassword: form.bindPassword }),
            };
            await (provider ? patchRequest(`auth/providers/admin/ldap/${provider.id}`, data) : putRequest("auth/providers/admin/ldap", { ...data, enabled: true }));
            onSave(); onClose();
        } catch (e) { sendToast("Error", e.message || T("messages.saveFailed")); }
    };

    const handleTest = async () => {
        if (!provider) return sendToast("Error", T("messages.saveFirst"));
        setTesting(true);
        try {
            const r = await postRequest(`auth/providers/admin/ldap/${provider.id}/test`);
            if (r.success) sendToast(t("common.success"), T("messages.testSuccess"));
        } catch (e) { sendToast("Error", e.message || T("messages.testFailed")); }
        finally { setTesting(false); }
    };

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="ldap-provider-dialog">
                <h2>{provider ? T("editTitle") : T("createTitle")}</h2>

                <div className="form-group">
                    <label>{T("fields.displayName")}</label>
                    <Input icon={mdiFormTextbox} placeholder={T("fields.displayNamePlaceholder")} value={form.name} setValue={set("name")} />
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label>{T("fields.host")}</label>
                        <Input icon={mdiServer} placeholder={T("fields.hostPlaceholder")} value={form.host} setValue={set("host")} />
                    </div>
                    <div className="form-group port-field">
                        <label>{T("fields.port")}</label>
                        <Input icon={mdiNumeric} type="number" placeholder="389" value={form.port} setValue={set("port")} />
                    </div>
                </div>

                <div className="form-group">
                    <label>{T("fields.bindDN")}</label>
                    <Input icon={mdiAccountMultiple} placeholder={T("fields.bindDNPlaceholder")} value={form.bindDN} setValue={set("bindDN")} />
                </div>

                <div className="form-group">
                    <label>{T("fields.bindPassword")}</label>
                    <Input icon={mdiKey} type="password" placeholder={provider ? T("fields.bindPasswordPlaceholderEdit") : T("fields.bindPasswordPlaceholder")} value={form.bindPassword} setValue={set("bindPassword")} />
                </div>

                <div className="form-group">
                    <label>{T("fields.baseDN")}</label>
                    <Input icon={mdiFormTextbox} placeholder={T("fields.baseDNPlaceholder")} value={form.baseDN} setValue={set("baseDN")} />
                </div>

                <div className="form-group">
                    <label>{T("fields.userSearchFilter")}</label>
                    <Input icon={mdiFilter} placeholder={T("fields.userSearchFilterPlaceholder")} value={form.userSearchFilter} setValue={set("userSearchFilter")} />
                </div>

                <div className="form-group toggle-group">
                    <label>{T("fields.useTLS")}</label>
                    <ToggleSwitch checked={form.useTLS} onChange={set("useTLS")} id="useTLS" />
                </div>

                <div className="advanced-settings">
                    <Button type="secondary" icon={mdiCog} onClick={() => setShowAdvanced(!showAdvanced)} text={showAdvanced ? T("advanced.hide") : T("advanced.show")} />
                    {showAdvanced && (
                        <div className="advanced-form">
                            {[["usernameAttr", "usernameAttribute", mdiAccountMultiple], ["firstNameAttr", "firstNameAttribute", mdiFormTextbox], ["lastNameAttr", "lastNameAttribute", mdiFormTextbox]].map(([key, field, icon]) => (
                                <div className="form-group" key={key}>
                                    <label>{T(`fields.${field}`)}</label>
                                    <Input icon={icon} placeholder={T(`fields.${field}Placeholder`)} value={form[key]} setValue={set(key)} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="button-row">
                    {provider && <Button type="secondary" icon={mdiTestTube} onClick={handleTest} text={testing ? T("actions.testing") : T("actions.testConnection")} disabled={testing} />}
                    <Button text={provider ? T("actions.saveChanges") : T("actions.addProvider")} onClick={handleSubmit} />
                </div>
            </div>
        </DialogProvider>
    );
};