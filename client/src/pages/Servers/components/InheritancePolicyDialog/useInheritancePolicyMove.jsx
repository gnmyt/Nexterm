import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import InheritancePolicyDialog from "./InheritancePolicyDialog.jsx";

export const useInheritancePolicyMove = () => {
    const { t } = useTranslation();
    const { sendToast } = useToast();
    const [pending, setPending] = useState(null);

    const execute = useCallback(async (request, onSuccess, policy) => {
        try {
            const result = await request(policy);
            if (result?.removedIdentityCount > 0) {
                sendToast("Warning", t("servers.inheritancePolicy.identitiesRemoved", "Some identities were removed because they are unavailable in the destination."));
            }
            onSuccess?.(result);
            return result;
        } catch (error) {
            if (error?.reason === "inheritance_policy_required") {
                setPending({ request, onSuccess, impact: error.impact });
                return null;
            }
            throw error;
        }
    }, [sendToast, t]);

    const runMove = useCallback((request, onSuccess) => execute(request, onSuccess), [execute]);
    const confirm = async (policy) => {
        const current = pending;
        if (!current) return;
        try {
            const result = await execute(current.request, current.onSuccess, policy);
            if (result !== null) setPending(null);
        } catch (error) {
            sendToast("Error", error.message || t("servers.inheritancePolicy.moveFailed", "Unable to move object"));
        }
    };

    return {
        runMove,
        policyDialog: <InheritancePolicyDialog
            open={Boolean(pending)}
            title={t("servers.inheritancePolicy.moveTitle", "Apply destination inheritance?")}
            description={t("servers.inheritancePolicy.moveDescription", "Choose whether moved objects adopt the destination folder settings or retain their current values.")}
            impact={pending?.impact}
            onConfirm={confirm}
            onCancel={() => setPending(null)}
        />,
    };
};
