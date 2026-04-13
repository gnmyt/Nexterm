import { useEffect, useContext } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { getRequest } from "@/common/utils/RequestUtil.js";

const applyActiveThemeCSS = (css) => {
    let el = document.getElementById("nexterm-custom-theme");
    if (!el) {
        el = document.createElement("style");
        el.id = "nexterm-custom-theme";
        document.body.appendChild(el);
    }
    el.textContent = css;
};

const removeActiveThemeCSS = () => {
    const el = document.getElementById("nexterm-custom-theme");
    if (el) el.remove();
};

const ThemeLoader = () => {
    const { user } = useContext(UserContext);

    useEffect(() => {
        if (!user?.activeThemeId) {
            removeActiveThemeCSS();
            return;
        }

        let cancelled = false;
        getRequest("themes/active/css")
            .then(({ css }) => {
                if (!cancelled && css) applyActiveThemeCSS(css);
            })
            .catch(() => {});

        return () => { cancelled = true; };
    }, [user?.activeThemeId]);

    return null;
};

export { ThemeLoader, applyActiveThemeCSS, removeActiveThemeCSS };