import { useEffect } from "react";

export const useBodyClass = (className, active) => {
    useEffect(() => {
        document.body.classList.toggle(className, active);
        return () => document.body.classList.remove(className);
    }, [className, active]);
};
