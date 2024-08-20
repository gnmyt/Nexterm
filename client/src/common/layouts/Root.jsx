import { Outlet } from "react-router-dom";
import Sidebar from "@/common/components/Sidebar";
import { UserProvider } from "@/common/contexts/UserContext.jsx";
import { ServerProvider } from "@/common/contexts/ServerContext.jsx";

export default () => {
    return (
        <div className="root">
            <UserProvider>
                <ServerProvider>
                    <div className="content-wrapper">
                        <Sidebar />
                        <Outlet />
                    </div>
                </ServerProvider>
            </UserProvider>
        </div>
    )
}