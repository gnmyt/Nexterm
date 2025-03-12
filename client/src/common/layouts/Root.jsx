import { Outlet } from "react-router-dom";
import Sidebar from "@/common/components/Sidebar";
import { UserProvider } from "@/common/contexts/UserContext.jsx";
import { ServerProvider } from "@/common/contexts/ServerContext.jsx";
import { IdentityProvider } from "@/common/contexts/IdentityContext.jsx";
import { ToastProvider } from "@/common/contexts/ToastContext.jsx";
import { ThemeProvider } from "@/common/contexts/ThemeContext.jsx";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { SessionProvider } from "@/common/contexts/SessionContext.jsx";
import { SnippetProvider } from "@/common/contexts/SnippetContext.jsx";

export default () => {
    return (
        <DndProvider backend={HTML5Backend}>
            <ToastProvider>
                <ThemeProvider>
                    <UserProvider>
                        <ServerProvider>
                            <IdentityProvider>
                                <SnippetProvider>
                                    <SessionProvider>
                                        <div className="content-wrapper">
                                            <Sidebar />
                                            <div className="main-content">
                                                <Outlet />
                                            </div>
                                        </div>
                                    </SessionProvider>
                                </SnippetProvider>
                            </IdentityProvider>
                        </ServerProvider>
                    </UserProvider>
                </ThemeProvider>
            </ToastProvider>
        </DndProvider>
    );
}