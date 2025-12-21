import "./styles.sass";
import { useTerminalSettings } from "@/common/contexts/TerminalSettingsContext.jsx";
import SelectBox from "@/common/components/SelectBox";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export const Terminal = () => {
    const { t } = useTranslation();
    const {
        selectedTheme, setSelectedTheme, selectedFont, setSelectedFont,
        fontSize, setFontSize, cursorStyle, setCursorStyle, cursorBlink, setCursorBlink,
        getAvailableThemes, getAvailableFonts, getTerminalTheme, getCursorStyles,
    } = useTerminalSettings();

    const [previewText] = useState(t("settings.terminal.preview.text"));
    const themes = getAvailableThemes();
    const fonts = getAvailableFonts();
    const cursorStyles = getCursorStyles();

    const fontOptions = fonts.map(font => ({ label: font.name, value: font.value }));
    const fontSizeOptions = Array.from({ length: 13 }, (_, i) => i + 10)
        .concat([24, 26, 28, 30, 32])
        .map(size => ({ label: `${size}px`, value: size }));
    const cursorStyleOptions = cursorStyles.map(style => ({ label: style.name, value: style.value }));

    const cursorBlinkOptions = [
        { label: t("settings.terminal.cursor.enabled"), value: "true" }, 
        { label: t("settings.terminal.cursor.disabled"), value: "false" }
    ];

    const fontStyle = { fontFamily: selectedFont, fontSize: `${fontSize}px` };

    const renderTerminalPreview = (theme) => {
        const themeColors = getTerminalTheme(theme.key);
        const previewLines = previewText.split("\n");

        return (
            <div className="terminal-preview"
                 style={{ backgroundColor: themeColors.background, color: themeColors.foreground, ...fontStyle }}>
                <div className="terminal-content" style={fontStyle}>
                    {previewLines.map((line, index) => (
                        <div key={index} className="terminal-line" style={fontStyle}>
                            {line}
                            {index === previewLines.length - 1 && (
                                <span
                                    className={`terminal-cursor cursor-${cursorStyle} ${cursorBlink ? "blinking" : ""}`}
                                    style={{
                                        backgroundColor: cursorStyle === "block" ? themeColors.cursor : "transparent",
                                        borderColor: themeColors.cursor,
                                    }} />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderSection = (title, description, children) => (
        <div className="terminal-section">
            <h2>{title}</h2>
            <div className="section-inner">
                <p>{description}</p>
                {children}
            </div>
        </div>
    );

    const renderFontOption = (label, options, selected, setter) => (
        <div className="font-option">
            <label>{label}</label>
            <SelectBox options={options} selected={selected} setSelected={setter} />
        </div>
    );

    return (
        <div className="terminal-settings-page">
            {renderSection(t("settings.terminal.font.title"), t("settings.terminal.font.description"), (
                <div className="font-settings">
                    {renderFontOption(t("settings.terminal.font.fontFamily"), fontOptions, selectedFont, setSelectedFont)}
                    {renderFontOption(t("settings.terminal.font.fontSize"), fontSizeOptions, fontSize, setFontSize)}
                </div>
            ))}

            {renderSection(t("settings.terminal.cursor.title"), t("settings.terminal.cursor.description"), (
                <div className="cursor-settings">
                    {renderFontOption(t("settings.terminal.cursor.cursorStyle"), cursorStyleOptions, cursorStyle, setCursorStyle)}
                    {renderFontOption(t("settings.terminal.cursor.cursorBlinking"), cursorBlinkOptions, cursorBlink.toString(), (value) => setCursorBlink(value === "true"))}
                </div>
            ))}

            {renderSection(t("settings.terminal.theme.title"), t("settings.terminal.theme.description"), (
                <div className="theme-cards">
                    {themes.map((theme) => (
                        <div 
                            key={theme.key} 
                            className={`theme-card ${selectedTheme === theme.key ? "selected" : ""}`}
                            onClick={() => setSelectedTheme(theme.key)}
                        >
                            <div className="theme-header">
                                <h4>{theme.name}</h4>
                                {selectedTheme === theme.key && <div className="selected-indicator" />}
                            </div>
                            {renderTerminalPreview(theme)}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
};
