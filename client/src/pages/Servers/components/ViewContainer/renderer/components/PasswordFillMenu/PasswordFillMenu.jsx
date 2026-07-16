import Icon from "@mdi/react";
import { mdiKeyboardReturn } from "@mdi/js";
import "./styles.sass";

const isDarkColor = (color) => {
    const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color?.trim() || "");
    if (!hex) return true;

    let value = hex[1];
    if (value.length === 3) value = value.split("").map(c => c + c).join("");
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) < 128;
};

export const PasswordFillMenu = ({ style, items, selectedIndex, onFill, onSelect, terminalTheme, fontSize }) => {
    const menuStyle = {
        ...style,
        "--pfm-bg": terminalTheme.background,
        "--pfm-fg": terminalTheme.foreground,
        "--pfm-mix": isDarkColor(terminalTheme.background) ? "#FFFFFF" : "#000000",
        fontSize: `${fontSize}px`,
    };

    return (
        <div className="password-fill-menu" style={menuStyle} role="menu" aria-orientation="vertical">
            {items.map((item, index) => (
                <div
                    key={item.id}
                    className="password-fill-menu__option"
                    onClick={() => onFill(item.id)}
                    onMouseEnter={() => onSelect(index)}
                    role="menuitem"
                    tabIndex={-1}
                >
                    <span
                        className={`password-fill-menu__title ${selectedIndex === index ? "selected" : ""}`}
                        data-text={item.label}
                    >
                        <span>{item.label}</span>
                    </span>
                    <Icon
                        path={mdiKeyboardReturn}
                        className={`password-fill-menu__enter ${selectedIndex === index ? "visible" : ""}`}
                    />
                </div>
            ))}
        </div>
    );
};
