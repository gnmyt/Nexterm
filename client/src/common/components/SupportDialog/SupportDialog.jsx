import "./styles.sass";
import { DialogProvider } from "@/common/components/Dialog";
import Icon from "@mdi/react";
import { mdiBugOutline, mdiOpenInNew } from "@mdi/js";
import { siDiscord, siGithub } from "simple-icons";
import { DISCORD_URL, GITHUB_URL } from "@/App.jsx";
import { useTranslation } from "react-i18next";

export const SupportDialog = ({ open, onClose }) => {
    const { t } = useTranslation();

    const openUrl = (url) => {
        window.open(url, "_blank");
        onClose();
    };

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="support-dialog">
                <h2>{t("support.title", "Get Support")}</h2>
                <p>{t("support.subtitle", "Need help or want to contribute?")}</p>
                
                <div className="support-options">
                    <div className="support-option" onClick={() => openUrl(`${GITHUB_URL}/issues`)}>
                        <div className="option-icon">
                            <Icon path={mdiBugOutline} />
                        </div>
                        <div className="option-text">
                            <span className="option-title">{t("support.issues.title", "Report an Issue")}</span>
                            <span className="option-desc">{t("support.issues.description", "Found a bug or have a feature request?")}</span>
                        </div>
                        <Icon path={mdiOpenInNew} className="option-arrow" />
                    </div>

                    <div className="support-option discord" onClick={() => openUrl(DISCORD_URL)}>
                        <div className="option-icon">
                            <Icon path={siDiscord.path} />
                        </div>
                        <div className="option-text">
                            <span className="option-title">{t("support.discord.title", "Join Discord")}</span>
                            <span className="option-desc">{t("support.discord.description", "Chat with the community and get help.")}</span>
                        </div>
                        <Icon path={mdiOpenInNew} className="option-arrow" />
                    </div>

                    <div className="support-option github" onClick={() => openUrl(GITHUB_URL)}>
                        <div className="option-icon">
                            <Icon path={siGithub.path} />
                        </div>
                        <div className="option-text">
                            <span className="option-title">{t("support.github.title", "View on GitHub")}</span>
                            <span className="option-desc">{t("support.github.description", "Browse source code and contribute.")}</span>
                        </div>
                        <Icon path={mdiOpenInNew} className="option-arrow" />
                    </div>
                </div>

                <p className="support-footer">{t("support.footer", "Thank you for using Nexterm!")}</p>
            </div>
        </DialogProvider>
    );
};

export default SupportDialog;
