import {Outlet} from "react-router-dom";
import Navigation from "@/common/components/Navigation";
import "./styles.sass";

export const Root = () => {
    return (
        <div className="app-root">
            <Navigation />
            <main className="main-content">
                <Outlet/>
            </main>
        </div>
  );
}