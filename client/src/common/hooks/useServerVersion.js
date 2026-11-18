import { useEffect, useState } from "react";
import { getRequest } from "@/common/utils/RequestUtil.js";

export const useServerVersion = (enabled = true) => {
    const [version, setVersion] = useState(null);

    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;
        getRequest("service/version")
            .then(data => !cancelled && setVersion(data.version))
            .catch(() => !cancelled && setVersion(null));
        return () => {
            cancelled = true;
        };
    }, [enabled]);

    return version;
};
