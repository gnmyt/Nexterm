import { useTranslation } from "react-i18next";
import { mdiCheck, mdiClose, mdiShieldOffOutline } from "@mdi/js";
import { DialogProvider } from "@/common/components/Dialog";
import Button from "@/common/components/Button";
import "./styles.sass";

const formatDate = (value) => (value ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : null);

const Fingerprint = ({ label, value, tone }) => (
    <div className={`certificate-review__fingerprint${tone ? ` certificate-review__fingerprint--${tone}` : ""}`}>
        <span className="certificate-review__label">{label}</span>
        <code className="certificate-review__value">{value}</code>
    </div>
);

const CertificateFacts = ({ certificate }) => {
    const { t } = useTranslation();

    const facts = [
        [t("servers.trust.subject"), certificate?.subject],
        [t("servers.trust.issuer"), certificate?.selfSigned ? t("servers.trust.selfSigned") : certificate?.issuer],
        [t("servers.trust.validUntil"), formatDate(certificate?.validTo)],
    ].filter(([, value]) => value);
    if (!facts.length) return null;

    return (
        <dl className="certificate-review__facts">
            {facts.map(([label, value]) => (
                <div key={label} className="certificate-review__fact">
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                </div>
            ))}
        </dl>
    );
};

export const CertificateReview = ({ peer, onAccept, onCancel, acceptText, cancelText, busy = false, error = null }) => {
    const { t } = useTranslation();

    const changed = peer.status === "changed";
    const blocked = !peer.canAccept;
    const subject = t(peer.kind === "ssh" ? "servers.trust.hostKey" : "servers.trust.certificate");
    const endpoint = `${peer.host}:${peer.port}`;
    const hint = error || (blocked ? t("servers.trust.blocked", { organization: peer.organizationName }) : null);

    return (
        <div className="certificate-review">
            <div className="certificate-review__text">
                <h2>{t(changed ? "servers.trust.changedTitle" : "servers.trust.newTitle", { subject })}</h2>
                <p>{t(changed ? "servers.trust.changedMessage" : "servers.trust.newMessage", { subject, endpoint })}</p>
            </div>

            <div className="certificate-review__card">
                {changed && <Fingerprint label={t("servers.trust.previous")} value={peer.previous.fingerprint} tone="previous" />}
                <Fingerprint label={t(changed ? "servers.trust.presented" : "servers.trust.fingerprint")}
                             value={peer.fingerprint} tone={changed ? "changed" : null} />
                <CertificateFacts certificate={peer.certificate} />
            </div>

            {hint && <p className={`certificate-review__hint${error ? " certificate-review__hint--error" : ""}`}>{hint}</p>}

            <div className="certificate-review__actions">
                {changed ? (
                    <>
                        {!blocked && (
                            <Button type="secondary" icon={mdiShieldOffOutline} disabled={busy}
                                    text={t("servers.trust.acceptChanged")} onClick={onAccept} />
                        )}
                        <Button type="danger" icon={mdiClose} disabled={busy}
                                text={cancelText || t("servers.trust.cancel")} onClick={onCancel} />
                    </>
                ) : (
                    <>
                        <Button type="secondary" icon={mdiClose} disabled={busy}
                                text={cancelText || t("servers.trust.cancel")} onClick={onCancel} />
                        <Button icon={mdiCheck} disabled={busy}
                                text={acceptText || t("servers.trust.acceptOnly")} onClick={onAccept} />
                    </>
                )}
            </div>
        </div>
    );
};

export const CertificateReviewDialog = ({ peer, onAccept, onClose }) => {
    if (!peer) return null;

    return (
        <DialogProvider open={!!peer} onClose={onClose}>
            <div className="certificate-review-dialog">
                <CertificateReview peer={peer} onAccept={onAccept} onCancel={onClose} />
            </div>
        </DialogProvider>
    );
};
