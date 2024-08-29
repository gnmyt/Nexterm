import { Outlet } from "react-router-dom";
import Sidebar from "@/common/components/Sidebar";
import { UserProvider } from "@/common/contexts/UserContext.jsx";
import { ServerProvider } from "@/common/contexts/ServerContext.jsx";
import { IdentityProvider } from "@/common/contexts/IdentityContext.jsx";

export default () => {
    return (
        <UserProvider>
            <ServerProvider>
                <IdentityProvider>
                    <div className="content-wrapper">
                        <Sidebar />
                        <Outlet />
                    </div>
                </IdentityProvider>
            </ServerProvider>
        </UserProvider>
    )
}