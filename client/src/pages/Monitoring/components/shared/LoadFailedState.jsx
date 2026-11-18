import { mdiAlertCircleOutline, mdiRefresh } from "@mdi/js";
import { useTranslation } from "react-i18next";
import Button from "@/common/components/Button";
import EmptyState from "@/common/components/EmptyState";

export const LoadFailedState = ({ onRetry, className }) => {
    const { t } = useTranslation();

    return (
        <EmptyState className={className} icon={mdiAlertCircleOutline} title={t("monitoring.errors.loadFailed")}
                    description={t("monitoring.errors.loadFailedDescription")}>
            <Button text={t("monitoring.errors.retry")} icon={mdiRefresh} size="small" onClick={onRetry} />
        </EmptyState>
    );
};
