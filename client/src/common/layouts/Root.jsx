import { Outlet } from "react-router-dom";
import Sidebar from "@/common/components/Sidebar";
import { UserProvider } from "@/common/contexts/UserContext.jsx";

export default () => {
    return (
        <div className="root">
            <UserProvider>
                <Sidebar />
                <Outlet />
            </UserProvider>
        </div>
    )
}