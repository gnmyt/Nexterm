import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App.jsx";
import { PreferencesProvider } from "@/common/contexts/PreferencesContext.jsx";

document.addEventListener("contextmenu", (e) => {
    const tag = e.target.tagName?.toLowerCase();
    const isEditable = tag === "input" || tag === "textarea" || e.target.isContentEditable;
    if (!isEditable) e.preventDefault();
});

const setViewportHeight = () => {
    const height = window.visualViewport?.height || window.innerHeight;
    document.documentElement.style.setProperty("--viewport-height", `${height}px`);
};

setViewportHeight();
window.addEventListener("resize", setViewportHeight);
window.visualViewport?.addEventListener("resize", setViewportHeight);
window.visualViewport?.addEventListener("scroll", setViewportHeight);

createRoot(document.getElementById("root")).render(
    <StrictMode>
        <PreferencesProvider>
            <App />
        </PreferencesProvider>
    </StrictMode>,
);
