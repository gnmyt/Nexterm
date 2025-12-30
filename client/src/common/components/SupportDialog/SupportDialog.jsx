import "./styles.sass";
import { DialogProvider } from "@/common/components/Dialog";
import Icon from "@mdi/react";
import { mdiBugOutline, mdiOpenInNew } from "@mdi/js";
import { siDiscord, siGithub } from "simple-icons";
import { DISCORD_URL, GITHUB_URL } from "@/App.jsx";
import { useTranslation } from "react-i18next";
import { openExternalUrl } from "@/common/utils/TauriUtil.js";

export const SupportDialog = ({ open, onClose }) => {
    const { t } = useTranslation();

    const openUrl = (url) => {
        openExternalUrl(url);
        onClose();
    };

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="support-dialog">
                <h2>{t("support.title")}</h2>
                <p>{t("support.subtitle")}</p>
                
                <div className="support-options">
                    <div className="support-option" onClick={() => openUrl(`${GITHUB_URL}/issues`)}>
                        <div className="option-icon">
                            <Icon path={mdiBugOutline} />
                        </div>
                        <div className="option-text">
                            <span className="option-title">{t("support.issues.title")}</span>
                            <span className="option-desc">{t("support.issues.description")}</span>
                        </div>
                        <Icon path={mdiOpenInNew} className="option-arrow" />
                    </div>

                    <div className="support-option discord" onClick={() => openUrl(DISCORD_URL)}>
                        <div className="option-icon">
                            <Icon path={siDiscord.path} />
                        </div>
                        <div className="option-text">
                            <span className="option-title">{t("support.discord.title")}</span>
                            <span className="option-desc">{t("support.discord.description")}</span>
                        </div>
                        <Icon path={mdiOpenInNew} className="option-arrow" />
                    </div>

                    <div className="support-option github" onClick={() => openUrl(GITHUB_URL)}>
                        <div className="option-icon">
                            <Icon path={siGithub.path} />
                        </div>
                        <div className="option-text">
                            <span className="option-title">{t("support.github.title")}</span>
                            <span className="option-desc">{t("support.github.description")}</span>
                        </div>
                        <Icon path={mdiOpenInNew} className="option-arrow" />
                    </div>
                </div>

                <p className="support-footer">{t("support.footer")}</p>
            </div>
        </DialogProvider>
    );
};

export default SupportDialog;
