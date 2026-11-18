import { useState } from "react";
import Icon from "@mdi/react";
import { mdiLaptop, mdiServer, mdiShieldAlert, mdiShieldKeyOutline } from "@mdi/js";
import { useTranslation } from "react-i18next";
import CertificateReview from "@/common/components/CertificateReview";
import { postRequest } from "@/common/utils/RequestUtil.js";
import { freezeProgress } from "../ConnectionLoader/progress.js";
import "../ConnectionLoader/styles.sass";
import "./styles.sass";

export const TrustPrompt = ({ session, challenge, onClose }) => {
    const { t } = useTranslation();
    const [frozenAt] = useState(() => freezeProgress(session.id));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    const changed = challenge.status === "changed";

    const answer = async (accept) => {
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
            await postRequest(`connections/${session.id}/trust`, { fingerprint: challenge.fingerprint, accept });
            if (!accept) onClose?.();
        } catch (failure) {
            setError(failure?.error || failure?.message || t("servers.trust.failed"));
            setBusy(false);
        }
    };

    return (
        <div className={`trust-prompt${changed ? " trust-prompt--changed" : ""}`}>
            <div className="connection-loader__progress-bar"
                 style={{ animationDelay: `-${frozenAt}ms`, animationPlayState: "paused" }} />
            <div className="trust-prompt__visual">
                <Icon path={mdiLaptop} className="trust-prompt__device-icon" />
                <div className="trust-prompt__link">
                    <span className="trust-prompt__link-line" />
                    <span className="trust-prompt__link-badge">
                        <Icon path={changed ? mdiShieldAlert : mdiShieldKeyOutline} />
                    </span>
                    <span className="trust-prompt__link-line" />
                </div>
                <Icon path={mdiServer} className="trust-prompt__device-icon" />
            </div>

            <CertificateReview peer={challenge} busy={busy} error={error}
                               onAccept={() => answer(true)} onCancel={() => answer(false)}
                               acceptText={t("servers.trust.accept")}
                               cancelText={changed ? t("servers.trust.disconnect") : undefined} />
        </div>
    );
};
