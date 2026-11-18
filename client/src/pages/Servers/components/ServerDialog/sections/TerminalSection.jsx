import { mdiKeyboardOutline } from "@mdi/js";
import { useTranslation } from "react-i18next";
import SelectBox from "@/common/components/SelectBox";
import { SectionBlock } from "@/common/components/SectionedDialog";
import Field from "@/common/components/Field";

const BACKSPACE_MODES = [{ label: "DEL", value: "del" }, { label: "^H", value: "ctrl-h" }];
const DELETE_MODES = [{ label: "VT", value: "vt" }, { label: "DEL", value: "del" }];
const FUNCTION_KEY_MODES = [{ label: "Xterm", value: "xterm" }, { label: "VT", value: "vt" }, { label: "Linux", value: "linux" }];

export const TerminalFields = ({ config, setConfig }) => {
    const { t } = useTranslation();
    const update = (patch) => setConfig(prev => ({ ...prev, ...patch }));

    return (
        <div className="sd-row sd-row--thirds">
            <Field label={t("servers.dialog.settings.terminal.backspace")} configKey="backspaceMode">
                <SelectBox options={BACKSPACE_MODES} selected={config.backspaceMode || "del"}
                           setSelected={(value) => update({ backspaceMode: value })} />
            </Field>
            <Field label={t("servers.dialog.settings.terminal.delete")} configKey="deleteMode">
                <SelectBox options={DELETE_MODES} selected={config.deleteMode || "vt"}
                           setSelected={(value) => update({ deleteMode: value })} />
            </Field>
            <Field label={t("servers.dialog.settings.terminal.functionKeys")} configKey="functionKeyMode">
                <SelectBox options={FUNCTION_KEY_MODES} selected={config.functionKeyMode || "xterm"}
                           setSelected={(value) => update({ functionKeyMode: value })} />
            </Field>
        </div>
    );
};

const TerminalSection = ({ config, setConfig }) => {
    const { t } = useTranslation();
    return (
        <SectionBlock id="terminal" icon={mdiKeyboardOutline} title={t("servers.dialog.settings.terminal.title")}
                      description={t("servers.dialog.settings.terminal.description")}>
            <TerminalFields config={config} setConfig={setConfig} />
        </SectionBlock>
    );
};

export default TerminalSection;
