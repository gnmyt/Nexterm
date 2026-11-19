import "./styles.sass";
import { useContext, useState } from "react";
import { DialogProvider } from "@/common/components/Dialog";
import Button from "@/common/components/Button";
import Icon from "@mdi/react";
import { mdiAlertOutline, mdiArrowDown, mdiCheck, mdiContentCopy, mdiOpenInNew } from "@mdi/js";
import { useTranslation } from "react-i18next";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { openExternalUrl } from "@/common/utils/TauriUtil.js";

const OLD_IMAGE = "germannewsmaker/nexterm";
const NEW_IMAGE = "nexterm/aio";
const UPGRADE_GUIDE_URL = "https://docs.nexterm.dev/installation";
const SEEN_KEY = "imageMigrationNoticeSeen";

export const ImageMigrationDialog = () => {
    const { t } = useTranslation();
    const { user, sessionToken } = useContext(UserContext);
    const [seenFingerprint, setSeenFingerprint] = useState(() => sessionStorage.getItem(SEEN_KEY));
    const [copied, setCopied] = useState(false);

    const fingerprint = sessionToken ? sessionToken.slice(-12) : null;
    const open = user?.role === "admin" && !!fingerprint && seenFingerprint !== fingerprint;

    const dismiss = () => {
        if (!fingerprint) return;
        sessionStorage.setItem(SEEN_KEY, fingerprint);
        setSeenFingerprint(fingerprint);
    };

    const copyImage = async () => {
        await navigator.clipboard.writeText(`${NEW_IMAGE}:latest`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <DialogProvider open={open} onClose={dismiss}>
            <div className="image-migration-dialog">
                <div className="migration-header">
                    <div className="migration-icon">
                        <Icon path={mdiAlertOutline} />
                    </div>
                    <div className="migration-heading">
                        <h2>{t("imageMigration.title")}</h2>
                        <p>{t("imageMigration.subtitle")}</p>
                    </div>
                </div>

                <p className="migration-text">{t("imageMigration.description")}</p>

                <div className="migration-images">
                    <div className="migration-image outdated">
                        <div className="image-info">
                            <span className="image-label">{t("imageMigration.currentImage")}</span>
                            <code>{OLD_IMAGE}</code>
                        </div>
                        <span className="image-chip">{t("imageMigration.noLongerUpdated")}</span>
                    </div>

                    <Icon path={mdiArrowDown} className="migration-arrow" />

                    <div className="migration-image">
                        <div className="image-info">
                            <span className="image-label">{t("imageMigration.newImage")}</span>
                            <code>{NEW_IMAGE}:latest</code>
                        </div>
                        {navigator.clipboard && (
                            <Button onClick={copyImage} icon={copied ? mdiCheck : mdiContentCopy} />
                        )}
                    </div>
                </div>

                <div className="btn-area">
                    <Button onClick={dismiss} type="secondary" text={t("imageMigration.remindLater")} />
                    <Button onClick={() => openExternalUrl(UPGRADE_GUIDE_URL)} type="primary" icon={mdiOpenInNew}
                            text={t("imageMigration.openGuide")} />
                </div>
            </div>
        </DialogProvider>
    );
};