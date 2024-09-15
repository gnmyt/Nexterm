import "@fontsource/plus-jakarta-sans/300.css";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/plus-jakarta-sans/800.css";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import Root from "@/common/layouts/Root.jsx";
import Servers from "@/pages/Servers";
import "@/common/styles/main.sass";
import Settings from "@/pages/Settings";
import Apps from "@/pages/Apps";

export const GITHUB_URL = "https://github.com/gnmyt/Nexterm";
export const DISCORD_URL = "https://dc.gnmyt.dev/";

const App = () => {
    const router = createBrowserRouter([
        {
            path: "/",
            element: <Root />,
            children: [
                { path: "/", element: <Navigate to="/servers" /> },
                { path: "/servers", element: <Servers /> },
                { path: "/settings/*", element: <Settings/> },
                { path: "/apps/*", element: <Apps /> }
            ],
        },
    ]);

    return <RouterProvider router={router} />;
}

export default App;