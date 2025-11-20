import { Outlet } from "react-router-dom";
import { UserProvider } from "@/common/contexts/UserContext.jsx";
import { ServerProvider } from "@/common/contexts/ServerContext.jsx";
import { IdentityProvider } from "@/common/contexts/IdentityContext.jsx";
import { ToastProvider } from "@/common/contexts/ToastContext.jsx";
import { TerminalSettingsProvider } from "@/common/contexts/TerminalSettingsContext.jsx";
import { AIProvider } from "@/common/contexts/AIContext.jsx";
import { KeymapProvider } from "@/common/contexts/KeymapContext.jsx";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { SessionProvider } from "@/common/contexts/SessionContext.jsx";
import { SnippetProvider } from "@/common/contexts/SnippetContext.jsx";
import { Suspense, lazy } from "react";
import Loading from "@/common/components/Loading";
import GlobalKeyboardHandler from "@/common/components/GlobalKeyboardHandler";

const Sidebar = lazy(() => import("@/common/components/Sidebar"));

export default () => {
    return (
        <DndProvider backend={HTML5Backend}>
            <ToastProvider>
                <TerminalSettingsProvider>
                    <UserProvider>
                        <KeymapProvider>
                            <AIProvider>
                                <ServerProvider>
                                    <IdentityProvider>
                                        <SnippetProvider>
                                            <SessionProvider>
                                                <GlobalKeyboardHandler />
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
                                            </SessionProvider>
                                        </SnippetProvider>
                                    </IdentityProvider>
                                </ServerProvider>
                            </AIProvider>
                        </KeymapProvider>
                    </UserProvider>
                </TerminalSettingsProvider>
            </ToastProvider>
        </DndProvider>
    );
}