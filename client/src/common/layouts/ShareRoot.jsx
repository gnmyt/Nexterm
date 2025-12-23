import { Outlet } from "react-router-dom";
import { ToastProvider } from "@/common/contexts/ToastContext.jsx";
import { TerminalSettingsProvider } from "@/common/contexts/TerminalSettingsContext.jsx";
import { KeymapProvider } from "@/common/contexts/KeymapContext.jsx";
import { ThemeProvider } from "@/common/contexts/ThemeContext.jsx";
import { Suspense } from "react";
import Loading from "@/common/components/Loading";
import { ErrorBoundary } from "@/common/components/ErrorBoundary";

export default () => {
    return (
        <ErrorBoundary>
            <ThemeProvider>
                <ToastProvider>
                    <TerminalSettingsProvider>
                        <KeymapProvider>
                            <Suspense fallback={<Loading />}>
                                <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
                                    <Outlet />
                                </div>
                            </Suspense>
                        </KeymapProvider>
                    </TerminalSettingsProvider>
                </ToastProvider>
            </ThemeProvider>
        </ErrorBoundary>
    );
};
