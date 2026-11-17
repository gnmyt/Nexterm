import { useCallback, useContext } from "react";
import { useTranslation } from "react-i18next";
import { patchRequest } from "@/common/utils/RequestUtil.js";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import { useToast } from "@/common/contexts/ToastContext.jsx";

export const useMove = () => {
    const { t } = useTranslation();
    const { loadServers } = useContext(ServerContext);
    const { sendToast } = useToast();

    return useCallback(async (path, body) => {
        const result = await patchRequest(path, body);
        if (result?.removedIdentityCount > 0) sendToast("Warning", t("servers.messages.identitiesRemovedOnMove"));
        loadServers();
        return result;
    }, [t, loadServers, sendToast]);
};
