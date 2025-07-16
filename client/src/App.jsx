import "@fontsource/plus-jakarta-sans/300.css";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/plus-jakarta-sans/800.css";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import "@/common/styles/main.sass";
import { lazy } from "react";
import Root from "@/common/layouts/Root.jsx";

const Servers = lazy(() => import("@/pages/Servers"));
const Settings = lazy(() => import("@/pages/Settings"));
const Apps = lazy(() => import("@/pages/Apps"));
const Snippets = lazy(() => import("@/pages/Snippets"));
const Monitoring = lazy(() => import("@/pages/Monitoring"));
const Audit = lazy(() => import("@/pages/Audit"));

export const GITHUB_URL = "https://github.com/gnmyt/Nexterm";
export const DISCORD_URL = "https://dc.gnm.dev/";

const App = () => {
    const router = createBrowserRouter([
        {
            path: "/",
            element: <Root />,
            children: [
                { path: "/", element: <Navigate to="/servers" /> },
                { path: "/servers", element: <Servers /> },
                { path: "/monitoring", element: <Monitoring /> },
                { path: "/audit", element: <Audit /> },
                { path: "/settings/*", element: <Settings/> },
                { path: "/apps/*", element: <Apps /> },
                { path: "/snippets", element: <Snippets /> }
            ],
        },
    ]);

    return <RouterProvider router={router} />;
}

export default App;