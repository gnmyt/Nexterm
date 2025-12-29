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
import { Suspense, useContext } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import Loading from "@/common/components/Loading";
import { ErrorBoundary } from "@/common/components/ErrorBoundary";

const PreferencesWrapper = ({ children }) => {
    const { user, login } = useContext(UserContext);
    return (
        <PreferencesProvider user={user} refreshUser={login}>
            {children}
        </PreferencesProvider>
    );
};

export default () => {
    return (
        <ErrorBoundary>
            <DndProvider backend={HTML5Backend}>
                <ToastProvider>
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
                                                            <Suspense fallback={<Loading />}>
                                                                <Outlet />
                                                            </Suspense>
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
                </ToastProvider>
            </DndProvider>
        </ErrorBoundary>
    );
}
