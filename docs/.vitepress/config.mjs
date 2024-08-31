import { defineConfig } from "vitepress";

export default defineConfig({
    title: "Nexterm",
    description: "The open source server management software for SSH, VNC & RDP",
    lastUpdated: true,
    cleanUrls: true,
    metaChunk: true,
    head: [
        ["link", { rel: "icon", type: "image/png", href: "/logo.png" }],
        ["meta", { name: "theme-color", content: "#1C2232" }],
        ["meta", { property: "og:type", content: "website" }],
        ["meta", { property: "og:locale", content: "en" }],
        ["meta", {
            property: "og:title",
            content: "Nexterm | The open source server management software for SSH, VNC & RDP",
        }],
        ["meta", { property: "og:site_name", content: "Nexterm" }],
        ["meta", { property: "og:image", content: "/thumbnail.png" }],
        ["meta", { property: "og:url", content: "https://docs.nexterm.dev" }],
    ],
    themeConfig: {

        logo: "/logo.png",

        nav: [
            { text: "Home", link: "/" },
            { text: "Preview", link: "/preview" },
        ],

        footer: {
            message: "Distributed under the MIT License",
            copyright: "© 2024 Mathias Wagner",
        },
        search: {
            provider: "local",
        },

        sidebar: [
            {
                text: "Documentation",
                items: [
                    { text: "Home", link: "/" },
                    { text: "Preview", link: "/preview" },
                ],
            },
        ],

        socialLinks: [
            { icon: "github", link: "https://github.com/gnmyt/Nexterm" },
            { icon: "discord", link: "https://discord.com/users/386242172632170496" },
        ],
    },
});
