import { lazy, Suspense, useState } from "react";

export const lazyDialog = (load, isOpen = (props) => props.open) => {
    const Dialog = lazy(load);

    const LazyDialog = (props) => {
        const [wanted, setWanted] = useState(false);
        if (!wanted && isOpen(props)) setWanted(true);
        if (!wanted) return null;
        return <Suspense fallback={null}><Dialog {...props} /></Suspense>;
    };
    return LazyDialog;
};
