import { useCallback, useMemo, useState } from "react";
import { serializeForCompare } from "@/common/utils/dirtyState.js";

export const useUnsavedChanges = (values, { normalize } = {}) => {
    const [baseline, setBaseline] = useState(null);

    const markClean = useCallback((next) => {
        setBaseline(next === undefined ? values : next);
    }, [values]);

    const reset = useCallback(() => setBaseline(null), []);

    const isDirty = useMemo(() => {
        if (baseline === null) return false;
        const prepare = (v) => serializeForCompare(normalize ? normalize(v) : v);
        return prepare(values) !== prepare(baseline);
    }, [values, baseline, normalize]);

    return { isDirty, markClean, reset };
};
