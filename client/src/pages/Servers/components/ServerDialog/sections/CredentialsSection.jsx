import { mdiAccountCircleOutline, mdiAccountKeyOutline, mdiLockOutline } from "@mdi/js";
import { useTranslation } from "react-i18next";
import Input from "@/common/components/IconInput";
import { SectionBlock } from "@/common/components/SectionedDialog";
import Field from "@/common/components/Field";

const CredentialsSection = ({ config, setConfig, description }) => {
    const { t } = useTranslation();
    const update = (patch) => setConfig(prev => ({ ...prev, ...patch }));

    return (
        <SectionBlock id="credentials" icon={mdiAccountKeyOutline} title={t("servers.dialog.sections.credentials")} description={description}>
            <div className="sd-row sd-row--split">
                <Field label={t("servers.proxmoxDialog.fields.username")} htmlFor="integration-username">
                    <Input icon={mdiAccountCircleOutline} type="text" id="integration-username" autoComplete="off"
                           placeholder={t("servers.proxmoxDialog.placeholders.username")}
                           value={config.username || ""} setValue={(value) => update({ username: value })} />
                </Field>
                <Field label={t("servers.proxmoxDialog.fields.password")} htmlFor="integration-password">
                    <Input icon={mdiLockOutline} type="password" id="integration-password" autoComplete="new-password"
                           placeholder={t("servers.proxmoxDialog.placeholders.password")}
                           value={config.password || ""} setValue={(value) => update({ password: value })} />
                </Field>
            </div>
        </SectionBlock>
    );
};

export default CredentialsSection;
