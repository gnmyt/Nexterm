import { Outlet } from "react-router-dom";
import Sidebar from "@/common/components/Sidebar";

export default () => {
    return (
        <div className="root">
            <Sidebar />
            <Outlet />
        </div>
    )
}