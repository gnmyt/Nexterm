import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiTimerSandComplete } from "@mdi/js";
import SelectBox from "@/common/components/SelectBox";
import { getRequest, patchRequest } from "@/common/utils/RequestUtil.js";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { SettingsHeading } from "@/common/components/SettingsDialog/SettingsHeading.jsx";
import "./styles.sass";

const IDLE_DAYS = [1, 7, 14, 30, 90, 0];
const LIFETIME_DAYS = [7, 30, 90, 180, 365, 0];

export const SessionLimits = () => {
    const { t } = useTranslation();
    const { sendToast } = useToast();
    const [limits, setLimits] = useState(null);

    useEffect(() => {
        getRequest("auth/sessions/settings").then(setLimits)
            .catch(() => sendToast(t("common.error"), t("settings.authentication.sessions.loadError")));
    }, []);

    const toOptions = (days) => days.map((value) => ({
        value: String(value),
        label: value === 0 ? t("settings.authentication.sessions.never") : t("settings.authentication.sessions.days", { count: value }),
    }));

    const update = async (field, value) => {
        const previous = limits;
        setLimits({ ...limits, [field]: Number(value) });
        try {
            setLimits(await patchRequest("auth/sessions/settings", { [field]: Number(value) }));
        } catch (error) {
            setLimits(previous);
            sendToast(t("common.error"), error?.message || t("settings.authentication.sessions.saveError"));
        }
    };

    if (!limits) return null;

    return (
        <div className="session-limits settings-page-section">
            <div className="section-header">
                <SettingsHeading>
                    <Icon path={mdiTimerSandComplete} size={0.8} />
                    {t("settings.authentication.sessions.title")}
                </SettingsHeading>
            </div>
            <div className="section-inner">
                <p>{t("settings.authentication.sessions.description")}</p>
            </div>
            <div className="section-inner session-limits__fields">
                <div className="session-limits__field">
                    <span className="session-limits__label">{t("settings.authentication.sessions.idle")}</span>
                    <SelectBox options={toOptions(IDLE_DAYS)} selected={String(limits.idleTimeoutDays)}
                               setSelected={(value) => update("idleTimeoutDays", value)} />
                </div>
                <div className="session-limits__field">
                    <span className="session-limits__label">{t("settings.authentication.sessions.lifetime")}</span>
                    <SelectBox options={toOptions(LIFETIME_DAYS)} selected={String(limits.maxLifetimeDays)}
                               setSelected={(value) => update("maxLifetimeDays", value)} />
                </div>
            </div>
        </div>
    );
};
