import { useLayoutEffect, useRef, useState } from "react";
import Icon from "@mdi/react";
import { mdiKeyboardTab, mdiUnfoldMoreHorizontal } from "@mdi/js";
import { useTranslation } from "react-i18next";
import "./styles.sass";

export const PasswordFillHint = ({ anchor, items, selectedIndex, onFill, onCycle, foreground, fontFamily, fontSize }) => {
    const hintRef = useRef(null);
    const [maxWidth, setMaxWidth] = useState(null);
    const { t } = useTranslation();

    const item = items[selectedIndex] ?? items[0];

    useLayoutEffect(() => {
        const containerWidth = hintRef.current?.parentElement?.clientWidth;
        if (!containerWidth) return;

        setMaxWidth(Math.max(0, containerWidth - anchor.left));
    }, [anchor.left, items, fontSize]);

    if (!item) return null;

    const hintStyle = { ...anchor, maxWidth, color: foreground, fontFamily, fontSize: `${fontSize}px` };

    return (
        <div ref={hintRef} className="password-fill-hint" style={hintStyle} role="status" aria-live="polite">
            <button type="button" className="password-fill-hint__fill" onClick={() => onFill(item.id)}>
                <Icon path={mdiKeyboardTab} className="password-fill-hint__key" />
                <span className="password-fill-hint__label">
                    {item.username
                        ? t("servers.passwordHint.pasteFor", { username: item.username })
                        : t("servers.passwordHint.paste")}
                </span>
            </button>
            {items.length > 1 && (
                <button type="button" className="password-fill-hint__cycle" onClick={() => onCycle(1)}
                        title={t("servers.passwordHint.cycle")} aria-label={t("servers.passwordHint.cycle")}>
                    <Icon path={mdiUnfoldMoreHorizontal} className="password-fill-hint__cycle-icon" />
                    <span className="password-fill-hint__counter">{selectedIndex + 1}/{items.length}</span>
                </button>
            )}
        </div>
    );
};
