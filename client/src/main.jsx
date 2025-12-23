import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App.jsx";
import { ThemeProvider } from "@/common/contexts/ThemeContext.jsx";
import "@fontsource/fira-code";
import "@fontsource/jetbrains-mono";
import "@fontsource/source-code-pro";
import "@fontsource/inconsolata";
import "@fontsource/ubuntu-mono";
import "@fontsource/roboto-mono";
import "hack-font/build/web/hack.css";

document.addEventListener("contextmenu", (e) => {
    const tag = e.target.tagName?.toLowerCase();
    const isEditable = tag === "input" || tag === "textarea" || e.target.isContentEditable;
    if (!isEditable) e.preventDefault();
});

createRoot(document.getElementById("root")).render(
    <StrictMode>
        <ThemeProvider>
            <App />
        </ThemeProvider>
    </StrictMode>,
);
