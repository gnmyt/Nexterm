import { useLayoutEffect, useRef, useState } from "react";
import Icon from "@mdi/react";
import { mdiKeyboardReturn } from "@mdi/js";
import "./styles.sass";

const EDGE_MARGIN = 8;

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

export const PasswordFillMenu = ({ anchor, items, selectedIndex, onFill, onSelect, terminalTheme, fontSize }) => {
    const menuRef = useRef(null);
    const [left, setLeft] = useState(anchor.left);

    useLayoutEffect(() => {
        const menu = menuRef.current;
        const containerWidth = menu?.parentElement?.clientWidth;
        if (!menu || !containerWidth) return;

        const maxLeft = containerWidth - menu.offsetWidth - EDGE_MARGIN;
        setLeft(Math.max(0, Math.min(anchor.left, maxLeft)));
    }, [anchor.left, items, fontSize]);

    const menuStyle = {
        ...anchor,
        left,
        "--pfm-bg": terminalTheme.background,
        "--pfm-fg": terminalTheme.foreground,
        "--pfm-mix": isDarkColor(terminalTheme.background) ? "#FFFFFF" : "#000000",
        fontSize: `${fontSize}px`,
    };

    return (
        <div ref={menuRef} className="password-fill-menu" style={menuStyle} role="menu" aria-orientation="vertical">
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
