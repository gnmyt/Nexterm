import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiAlertOutline } from "@mdi/js";
import { DialogProvider } from "@/common/components/Dialog";
import Button from "@/common/components/Button";
import "./styles.sass";

const MAX_LISTED = 6;

export const ConflictDialog = ({ conflict, onChoice, onClose }) => {
    const { t } = useTranslation();
    const open = !!conflict && !conflict.settled;
    const names = conflict?.names ?? [];
    const kind = conflict?.kind ?? "upload";
    const canRename = kind === "upload";

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="conflict-dialog">
                <div className="conflict-header">
                    <Icon path={mdiAlertOutline} />
                    <h2>{t("servers.fileManager.conflict.title", { count: names.length })}</h2>
                </div>
                <p>{t(`servers.fileManager.conflict.${kind}`, { count: names.length })}</p>
                <ul className="conflict-list">
                    {names.slice(0, MAX_LISTED).map(name => <li key={name}>{name}</li>)}
                    {names.length > MAX_LISTED && (
                        <li className="conflict-more">{t("servers.fileManager.conflict.more", { count: names.length - MAX_LISTED })}</li>
                    )}
                </ul>
                <div className="btn-area">
                    <Button type="secondary" text={t("common.actions.cancel")} onClick={() => onChoice("cancel")} />
                    <Button type="secondary" text={t("servers.fileManager.conflict.skip")} onClick={() => onChoice("skip")} />
                    {canRename && <Button type="secondary" text={t("servers.fileManager.conflict.rename")} onClick={() => onChoice("rename")} />}
                    <Button type="danger" text={t("servers.fileManager.conflict.overwrite")} onClick={() => onChoice("overwrite")} />
                </div>
            </div>
        </DialogProvider>
    );
};
