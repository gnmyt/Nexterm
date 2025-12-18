import "@fontsource/plus-jakarta-sans/300.css";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/plus-jakarta-sans/800.css";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import "@/common/styles/main.sass";
import { useEffect, useState, lazy } from "react";
import Root from "@/common/layouts/Root.jsx";
import PopoutRoot from "@/common/layouts/PopoutRoot.jsx";
import ShareRoot from "@/common/layouts/ShareRoot.jsx";
import TunnelRoot from "@/common/layouts/TunnelRoot.jsx";
import i18n from "./i18n.js";
import Loading from "@/common/components/Loading";
import { RouteErrorPage } from "@/common/components/ErrorBoundary";
import TitleBar from "@/common/components/TitleBar";

const Servers = lazy(() => import("@/pages/Servers"));
const Settings = lazy(() => import("@/pages/Settings"));
const Snippets = lazy(() => import("@/pages/Snippets"));
const Monitoring = lazy(() => import("@/pages/Monitoring"));
const Audit = lazy(() => import("@/pages/Audit"));
const Popout = lazy(() => import("@/pages/Popout"));
const Share = lazy(() => import("@/pages/Share"));
const Tunnel = lazy(() => import("@/pages/Tunnel"));

export const GITHUB_URL = "https://github.com/gnmyt/Nexterm";
export const DISCORD_URL = "https://dc.gnm.dev/";

const App = () => {
    const [translationsLoaded, setTranslationsLoaded] = useState(false);

    useEffect(() => {
        if (i18n.isInitialized) {
            setTranslationsLoaded(true);
            return;
        }
        
        i18n.on("initialized", () => {
            setTranslationsLoaded(true);
        });
    }, []);

    const router = createBrowserRouter([
        {
            path: "/",
            element: <Root />,
            errorElement: <RouteErrorPage />,
            children: [
                { path: "/", element: <Navigate to="/servers" /> },
                { path: "/servers", element: <Servers /> },
                { path: "/monitoring", element: <Monitoring /> },
                { path: "/monitoring/:serverId", element: <Monitoring /> },
                { path: "/monitoring/:serverId/:tab", element: <Monitoring /> },
                { path: "/audit", element: <Audit /> },
                { path: "/settings/*", element: <Settings/> },
                { path: "/snippets", element: <Snippets /> }
            ],
        },
        {
            path: "/popout",
            element: <PopoutRoot />,
            errorElement: <RouteErrorPage />,
            children: [
                { path: "/popout/:sessionId", element: <Popout /> }
            ],
        },
        {
            path: "/share",
            element: <ShareRoot />,
            errorElement: <RouteErrorPage />,
            children: [
                { path: "/share/:shareId", element: <Share /> }
            ],
        },
        {
            path: "/tunnel",
            element: <TunnelRoot />,
            errorElement: <RouteErrorPage />,
            children: [
                { path: "/tunnel/:entryId", element: <Tunnel /> }
            ],
        },
    ]);

    if (!translationsLoaded) {
        return (
            <div className="app-wrapper">
                <TitleBar />
                <Loading />
            </div>
        );
    }

    return <RouterProvider router={router}/>;
};

export default App;