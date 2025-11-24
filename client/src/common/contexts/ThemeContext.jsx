import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext({});

export const useTheme = () => useContext(ThemeContext);

const getSystemTheme = () => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return "dark";
    }
    return "light";
};

export const ThemeProvider = ({ children }) => {
    const [themeMode, setThemeMode] = useState(() => {
        const savedTheme = localStorage.getItem("theme");
        return savedTheme || "auto";
    });

    const [actualTheme, setActualTheme] = useState(() => {
        const savedTheme = localStorage.getItem("theme");
        if (!savedTheme || savedTheme === "auto") {
            return getSystemTheme();
        }
        return savedTheme;
    });

    useEffect(() => {
        if (themeMode === "auto") {
            const updateTheme = () => {
                const systemTheme = getSystemTheme();
                setActualTheme(systemTheme);
                document.documentElement.setAttribute("data-theme", systemTheme);
            };

            updateTheme();

            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handler = (e) => {
                const newTheme = e.matches ? "dark" : "light";
                setActualTheme(newTheme);
                document.documentElement.setAttribute("data-theme", newTheme);
            };

            mediaQuery.addEventListener('change', handler);
            return () => mediaQuery.removeEventListener('change', handler);
        } else {
            setActualTheme(themeMode);
            document.documentElement.setAttribute("data-theme", themeMode);
        }
    }, [themeMode]);

    useEffect(() => {
        localStorage.setItem("theme", themeMode);
    }, [themeMode]);

    const setTheme = (mode) => {
        setThemeMode(mode);
    };

    const toggleTheme = () => {
        setThemeMode(prevMode => {
            if (prevMode === "auto" || prevMode === "dark") return "light";
            return "dark";
        });
    };

    return (
        <ThemeContext.Provider value={{ theme: actualTheme, themeMode, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};