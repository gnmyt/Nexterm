import "@fontsource/plus-jakarta-sans/300.css";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/plus-jakarta-sans/800.css";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import "@/common/styles/main.sass";
import { lazy } from "react";
import Root, { AppLoading } from "@/common/layouts/Root.jsx";
import PopoutRoot from "@/common/layouts/PopoutRoot.jsx";
import ShareRoot from "@/common/layouts/ShareRoot.jsx";
import TunnelRoot from "@/common/layouts/TunnelRoot.jsx";
import LinkRoot from "@/common/layouts/LinkRoot.jsx";
import TranslationsReady from "@/common/components/TranslationsReady.jsx";
import { RouteErrorPage } from "@/common/components/ErrorBoundary";
import Servers from "@/pages/Servers";

const Snippets = lazy(() => import("@/pages/Snippets"));
const Monitoring = lazy(() => import("@/pages/Monitoring"));
const Audit = lazy(() => import("@/pages/Audit"));
const Popout = lazy(() => import("@/pages/Popout"));
const Share = lazy(() => import("@/pages/Share"));
const Tunnel = lazy(() => import("@/pages/Tunnel"));
const Link = lazy(() => import("@/pages/Link"));

export const GITHUB_URL = "https://github.com/gnmyt/Nexterm";
export const DISCORD_URL = "https://dc.gnm.dev/";
export const DOCS_URL = "https://docs.nexterm.dev/";

const whenTranslated = (layout) => <TranslationsReady fallback={<AppLoading />}>{layout}</TranslationsReady>;

const App = () => {
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
                { path: "/snippets", element: <Snippets /> }
            ],
        },
        {
            path: "/link",
            element: whenTranslated(<LinkRoot />),
            errorElement: <RouteErrorPage />,
            children: [
                { path: "/link", element: <Link /> }
            ],
        },
        {
            path: "/popout",
            element: whenTranslated(<PopoutRoot />),
            errorElement: <RouteErrorPage />,
            children: [
                { path: "/popout/:sessionId", element: <Popout /> },
                { path: "/popout/:sessionId/:monitor", element: <Popout /> }
            ],
        },
        {
            path: "/share",
            element: whenTranslated(<ShareRoot />),
            errorElement: <RouteErrorPage />,
            children: [
                { path: "/share/:shareId", element: <Share /> }
            ],
        },
        {
            path: "/tunnel",
            element: whenTranslated(<TunnelRoot />),
            errorElement: <RouteErrorPage />,
            children: [
                { path: "/tunnel/:entryId", element: <Tunnel /> }
            ],
        },
    ]);

    return <RouterProvider router={router}/>;
};

export default App;