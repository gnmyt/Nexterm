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
import { Suspense, lazy, useState, useEffect, useContext, useRef } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import Loading from "@/common/components/Loading";
import { ErrorBoundary } from "@/common/components/ErrorBoundary";
import TitleBar from "@/common/components/TitleBar";
import ConnectionErrorBanner from "@/common/components/ConnectionErrorBanner";
import { waitForTauri } from "@/common/utils/TauriUtil.js";
import MobileNav from "@/common/components/MobileNav";

const Sidebar = lazy(() => import("@/common/components/Sidebar"));

const PreferencesWrapper = ({ children }) => {
    const { user, login } = useContext(UserContext);
    return (
        <PreferencesProvider user={user} refreshUser={login}>
            {children}
        </PreferencesProvider>
    );
};

const AppContent = () => {
    const [tauriReady, setTauriReady] = useState(false);
    const [isLeftPaneCollapsed, setIsLeftPaneCollapsed] = useState(false);
    const [isLeftPaneHovering, setIsLeftPaneHovering] = useState(false);
    const leftPaneRef = useRef(null);
    const hoverBarRef = useRef(null);

    useEffect(() => {
        waitForTauri().then(() => {
            setTauriReady(true);
        });
    }, []);
    useEffect(() => {
        if (!isLeftPaneCollapsed) return;
        const isPointInRect = (rect, x, y) => rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
        const handleMouseMove = (event) => {
            const leftPaneRect = leftPaneRef.current?.getBoundingClientRect();
            const hoverBarRect = hoverBarRef.current?.getBoundingClientRect();
            const isOverLeftPane = isPointInRect(leftPaneRect, event.clientX, event.clientY);
            const isOverHoverBar = isPointInRect(hoverBarRect, event.clientX, event.clientY);
            const nextHovering = Boolean(isOverLeftPane || isOverHoverBar);
            setIsLeftPaneHovering(prev => (prev === nextHovering ? prev : nextHovering));
        };
        const handleMouseOut = (event) => {
            if (!event.relatedTarget) {
                setIsLeftPaneHovering(false);
            }
        };
        document.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseout", handleMouseOut);
        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseout", handleMouseOut);
        };
    }, [isLeftPaneCollapsed]);

    if (!tauriReady) {
        return (
            <div className="app-wrapper">
                <TitleBar />
                <Loading />
            </div>
        );
    }

    const isLeftPaneVisible = !isLeftPaneCollapsed || isLeftPaneHovering;

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
                                                            <div
                                                                className={`left-pane${isLeftPaneCollapsed ? " collapsed" : ""}${isLeftPaneVisible ? " open" : ""}`}
                                                                ref={leftPaneRef}
                                                            >
                                                                <Suspense fallback={<Loading />}>
                                                                    <Sidebar onToggleCollapse={() => setIsLeftPaneCollapsed(prev => !prev)} />
                                                                </Suspense>
                                                                <div className="left-pane-slot" id="left-pane-slot" />
                                                            </div>
                                                            <div
                                                                className={`left-pane-hover-bar${isLeftPaneCollapsed ? " active" : ""}`}
                                                                ref={hoverBarRef}
                                                            />
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