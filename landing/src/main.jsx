import React from "react";
import ReactDOM from "react-dom/client";
import "@/common/styles/fonts.sass";
import "@/common/styles/default.sass";
import {createBrowserRouter, RouterProvider} from "react-router-dom";
import Root from "@/common/layouts/Root";
import NotFound from "@/pages/NotFound";
import Home from "@/pages/Home";
import Install from "@/pages/Install";
import Changelog from "@/pages/Changelog";
import Downloads from "@/pages/Downloads";

const router = createBrowserRouter([
    {
        path: "/",
        element: <Root/>,
        errorElement: <NotFound />,
        children: [
            {index: true, element: <Home />},
            {path: "install", element: <Install />},
            {path: "changelog", element: <Changelog />},
            {path: "downloads", element: <Downloads />},
        ]
    }
]);

export const DOCUMENTATION_BASE = "https://docs.nexterm.dev";
export const GITHUB_LINK = "https://github.com/gnmyt/Nexterm";
export const DISCORD_LINK = "https://dc.gnmyt.dev";

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <RouterProvider router={router}/>
    </React.StrictMode>,
);
