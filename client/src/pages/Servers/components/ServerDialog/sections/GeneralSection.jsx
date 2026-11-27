import { lazy, Suspense, useEffect, useState } from "react";
import { mdiFormTextbox, mdiInformationOutline } from "@mdi/js";
import { useTranslation } from "react-i18next";
import Input from "@/common/components/IconInput";
import SelectBox from "@/common/components/SelectBox";
import { getRequest } from "@/common/utils/RequestUtil.js";
import { SectionBlock } from "@/common/components/SectionedDialog";
import Field from "@/common/components/Field";

const IconChooser = lazy(() => import("../components/IconChooser"));

export const EngineField = ({ config, setConfig }) => {
    const { t } = useTranslation();
    const [engines, setEngines] = useState([]);

    useEffect(() => {
        getRequest("engines").then(data => setEngines(data || [])).catch(() => {});
    }, []);

    if (engines.length < 2) return null;

    const engineOptions = engines.map(e => ({
        label: `${e.name}${e.connected ? "" : " " + t("servers.dialog.engineOffline")}`,
        value: String(e.id),
    }));

    return (
        <Field label={t("servers.dialog.fields.engine")} configKey="engineId">
            <SelectBox options={engineOptions}
                       selected={config.engineId ? String(config.engineId) : engineOptions[0]?.value}
                       setSelected={(value) => setConfig(prev => ({ ...prev, engineId: value }))} />
        </Field>
    );
};

const GeneralSection = ({ name, setName, icon, setIcon, config, setConfig, showIcon = true, showEngine = true, namePlaceholder }) => {
    const { t } = useTranslation();

    return (
        <SectionBlock id="general" icon={mdiInformationOutline} title={t("servers.dialog.sections.general")}>
            <div className={`sd-row${showIcon ? " sd-row--name" : ""}`}>
                <Field label={t("servers.dialog.fields.name")} htmlFor="name">
                    <Input icon={mdiFormTextbox} type="text" placeholder={namePlaceholder || t("servers.dialog.placeholders.serverName")}
                           id="name" autoComplete="off" value={name} setValue={setName} autoFocus />
                </Field>
                {showIcon && (
                    <Field label={t("servers.dialog.fields.icon")}>
                        <Suspense fallback={null}><IconChooser selected={icon} setSelected={setIcon} /></Suspense>
                    </Field>
                )}
            </div>

            {showEngine && <EngineField config={config} setConfig={setConfig} />}
        </SectionBlock>
    );
};

export default GeneralSection;
