import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App.jsx";
import { PreferencesProvider } from "@/common/contexts/PreferencesContext.jsx";

const isEditableTarget = (target) => {
    if (!target) return false;
    const tag = target.tagName?.toLowerCase();
    return tag === "input" || tag === "textarea" || target.isContentEditable;
};

const suppressNativeContextMenu = (e) => {
    if (isEditableTarget(e.target)) return;
    e.preventDefault();
};

document.addEventListener("contextmenu", suppressNativeContextMenu, { capture: true, passive: false });
window.addEventListener("contextmenu", suppressNativeContextMenu, { capture: true, passive: false });

const suppressRightClick = (e) => {
    if (isEditableTarget(e.target)) return;
    if (e.button === 2) e.preventDefault();
};

document.addEventListener("mousedown", suppressRightClick, { capture: true, passive: false });
document.addEventListener("pointerdown", suppressRightClick, { capture: true, passive: false });

const setViewportHeight = () => {
    const height = window.visualViewport?.height || window.innerHeight;
    document.documentElement.style.setProperty("--viewport-height", `${height}px`);
};

setViewportHeight();
window.addEventListener("resize", setViewportHeight);
window.visualViewport?.addEventListener("resize", setViewportHeight);
window.visualViewport?.addEventListener("scroll", setViewportHeight);

const preventZoomGesture = (e) => {
    if (e.touches && e.touches.length > 1) {
        e.preventDefault();
    }
};

document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });
document.addEventListener("gesturechange", (e) => e.preventDefault(), { passive: false });
document.addEventListener("gestureend", (e) => e.preventDefault(), { passive: false });
document.addEventListener("touchmove", preventZoomGesture, { passive: false });

createRoot(document.getElementById("root")).render(
    <StrictMode>
        <PreferencesProvider>
            <App />
        </PreferencesProvider>
    </StrictMode>,
);
