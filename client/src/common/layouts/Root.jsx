import { Outlet } from "react-router-dom";
import Sidebar from "@/common/components/Sidebar";
import { UserProvider } from "@/common/contexts/UserContext.jsx";
import { ServerProvider } from "@/common/contexts/ServerContext.jsx";
import { IdentityProvider } from "@/common/contexts/IdentityContext.jsx";
import { ToastProvider } from "@/common/contexts/ToastContext.jsx";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

export default () => {
    return (
        <DndProvider backend={HTML5Backend}>
            <UserProvider>
                <ServerProvider>
                    <IdentityProvider>
                        <ToastProvider>
                            <div className="content-wrapper">
                                <Sidebar />
                                <Outlet />
                            </div>
                        </ToastProvider>
                    </IdentityProvider>
                </ServerProvider>
            </UserProvider>
        </DndProvider>
    );
}