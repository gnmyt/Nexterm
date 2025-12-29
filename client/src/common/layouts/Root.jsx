import { Outlet } from "react-router-dom";
import { UserProvider } from "@/common/contexts/UserContext.jsx";
import { StateStreamProvider } from "@/common/contexts/StateStreamContext.jsx";
import { ServerProvider } from "@/common/contexts/ServerContext.jsx";
import { IdentityProvider } from "@/common/contexts/IdentityContext.jsx";
import { ToastProvider } from "@/common/contexts/ToastContext.jsx";
import { PreferencesProvider } from "@/common/contexts/PreferencesContext.jsx";
import { AIProvider } from "@/common/contexts/AIContext.jsx";
import { KeymapProvider } from "@/common/contexts/KeymapContext.jsx";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { SessionProvider } from "@/common/contexts/SessionContext.jsx";
import { SnippetProvider } from "@/common/contexts/SnippetContext.jsx";
import { ScriptProvider } from "@/common/contexts/ScriptContext.jsx";
import { QuickActionProvider } from "@/common/contexts/QuickActionContext.jsx";
import { Suspense, lazy, useState, useEffect, useContext } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import Loading from "@/common/components/Loading";
import { ErrorBoundary } from "@/common/components/ErrorBoundary";
import TitleBar from "@/common/components/TitleBar";
import ConnectionErrorBanner from "@/common/components/ConnectionErrorBanner";
import { waitForTauri } from "@/common/utils/TauriUtil.js";
import MobileNav from "@/common/components/MobileNav";

const Sidebar = lazy(() => import("@/common/components/Sidebar"));

const PreferencesWrapper = ({ children }) => {
    const { user } = useContext(UserContext);
    return (
        <PreferencesProvider user={user}>
            {children}
        </PreferencesProvider>
    );
};

const AppContent = () => {
    const [tauriReady, setTauriReady] = useState(false);

    useEffect(() => {
        waitForTauri().then(() => {
            setTauriReady(true);
        });
    }, []);

    if (!tauriReady) {
        return (
            <div className="app-wrapper">
                <TitleBar />
                <Loading />
            </div>
        );
    }

    return (
        <UserProvider>
            <PreferencesWrapper>
                <StateStreamProvider>
                    <KeymapProvider>
                        <AIProvider>
                            <ServerProvider>
                                <IdentityProvider>
                                    <SnippetProvider>
                                        <ScriptProvider>
                                            <SessionProvider>
                                                <QuickActionProvider>
                                                    <div className="app-wrapper">
                                                        <TitleBar />
                                                        <ConnectionErrorBanner />
                                                        <div className="content-wrapper">
                                                            <Suspense fallback={<Loading />}>
                                                                <Sidebar />
                                                            </Suspense>
                                                            <div className="main-content">
                                                                <Suspense fallback={<Loading />}>
                                                                    <Outlet />
                                                                </Suspense>
                                                            </div>
                                                        </div>
                                                        <MobileNav />
                                                    </div>
                                                </QuickActionProvider>
                                            </SessionProvider>
                                        </ScriptProvider>
                                    </SnippetProvider>
                                </IdentityProvider>
                            </ServerProvider>
                        </AIProvider>
                    </KeymapProvider>
                </StateStreamProvider>
            </PreferencesWrapper>
        </UserProvider>
    );
};

export default () => {
    return (
        <ErrorBoundary>
            <DndProvider backend={HTML5Backend}>
                <ToastProvider>
                    <AppContent />
                </ToastProvider>
            </DndProvider>
        </ErrorBoundary>
    );
}