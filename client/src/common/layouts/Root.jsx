import { Outlet } from "react-router-dom";
import { UserProvider } from "@/common/contexts/UserContext.jsx";
import { ServerProvider } from "@/common/contexts/ServerContext.jsx";
import { IdentityProvider } from "@/common/contexts/IdentityContext.jsx";
import { ToastProvider } from "@/common/contexts/ToastContext.jsx";
import { TerminalSettingsProvider } from "@/common/contexts/TerminalSettingsContext.jsx";
import { AIProvider } from "@/common/contexts/AIContext.jsx";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { SessionProvider } from "@/common/contexts/SessionContext.jsx";
import { SnippetProvider } from "@/common/contexts/SnippetContext.jsx";
import { Suspense, lazy } from "react";
import Loading from "@/common/components/Loading";

const Sidebar = lazy(() => import("@/common/components/Sidebar"));

export default () => {
    return (
        <DndProvider backend={HTML5Backend}>
            <ToastProvider>
                <TerminalSettingsProvider>
                    <UserProvider>
                        <AIProvider>
                            <ServerProvider>
                                <IdentityProvider>
                                    <SnippetProvider>
                                        <SessionProvider>
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
                    </UserProvider>
                </TerminalSettingsProvider>
            </ToastProvider>
        </DndProvider>
    );
}