import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Icon from "@mdi/react";
import { mdiMagnify } from "@mdi/js";
import "./styles.sass";

const KEYBOARD_SHORTCUTS = [
    { label: "Ctrl+Alt+Del", keys: [0xffe3, 0xffe9, 0xffff], category: "System" },
    { label: "Alt+Tab", keys: [0xffe9, 0xff09], category: "Windows" },
    { label: "Windows Key", keys: [0xffeb], category: "Windows" },
    { label: "Ctrl+Shift+Esc", keys: [0xffe3, 0xffe1, 0xff1b], category: "Windows" },
    { label: "Alt+F4", keys: [0xffe9, 0xffc1], category: "Windows" },
    { label: "Win+L", keys: [0xffeb, 0x6c], category: "Windows" },
    { label: "Win+R", keys: [0xffeb, 0x72], category: "Windows" },
    { label: "Ctrl+Alt+F1", keys: [0xffe3, 0xffe9, 0xffbe], category: "Linux" },
    { label: "Ctrl+Alt+F2", keys: [0xffe3, 0xffe9, 0xffbf], category: "Linux" },
    { label: "Ctrl+Alt+Backspace", keys: [0xffe3, 0xffe9, 0xff08], category: "Linux" },
];

export const KeyboardShortcutsMenu = ({ visible, onClose, onSelect }) => {
    const [search, setSearch] = useState("");
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [isPositioned, setIsPositioned] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const searchRef = useRef(null);
    const menuRef = useRef(null);
    const shortcutRefs = useRef([]);

    const filtered = search
        ? KEYBOARD_SHORTCUTS.filter(s => 
            s.label.toLowerCase().includes(search.toLowerCase()) ||
            s.category.toLowerCase().includes(search.toLowerCase()))
        : KEYBOARD_SHORTCUTS;

    useEffect(() => {
        if (visible) {
            setIsVisible(true);
            setSearch("");
            setHighlightedIndex(-1);
            requestAnimationFrame(() => requestAnimationFrame(() => {
                setIsPositioned(true);
                searchRef.current?.focus();
            }));
        } else {
            setIsPositioned(false);
        }
    }, [visible]);

    useEffect(() => {
        if (!visible) return;

        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
        };

        const handleKeyDown = (e) => {
            if (e.key === "Escape") return e.preventDefault(), onClose();

            if (searchRef.current === document.activeElement) {
                if (e.key === "ArrowDown" && filtered.length > 0) {
                    e.preventDefault();
                    searchRef.current.blur();
                    setHighlightedIndex(0);
                    shortcutRefs.current[0]?.focus();
                }
                return;
            }

            const navigate = (dir) => {
                e.preventDefault();
                const newIndex = (highlightedIndex + dir + filtered.length) % filtered.length;
                setHighlightedIndex(newIndex);
                shortcutRefs.current[newIndex]?.focus();
                shortcutRefs.current[newIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
            };

            if (e.key === "ArrowDown") navigate(1);
            else if (e.key === "ArrowUp") navigate(-1);
            else if (e.key === "Enter" && highlightedIndex >= 0) {
                e.preventDefault();
                onSelect?.(filtered[highlightedIndex].keys);
                onClose();
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [visible, filtered, highlightedIndex, onClose, onSelect]);

    if (!isVisible) return null;

    return createPortal(
        <div className="keyboard-shortcuts-overlay" onClick={onClose}>
            <div 
                ref={menuRef}
                className={`keyboard-shortcuts-menu ${visible && isPositioned ? 'open' : 'closed'}`}
                onClick={(e) => e.stopPropagation()}
                onTransitionEnd={(e) => e.target === menuRef.current && !visible && setIsVisible(false)}
                role="menu"
                aria-orientation="vertical"
            >
                <div className="keyboard-shortcuts-menu__search">
                    <Icon path={mdiMagnify} />
                    <input 
                        ref={searchRef}
                        type="text" 
                        placeholder="Search shortcuts..." 
                        value={search} 
                        onChange={(e) => (setSearch(e.target.value), setHighlightedIndex(-1))}
                    />
                </div>

                <div className="keyboard-shortcuts-menu__content">
                    {filtered.length === 0 ? (
                        <div className="keyboard-shortcuts-menu__no-results">
                            <p>No shortcuts match your search.</p>
                        </div>
                    ) : (
                        <div className="keyboard-shortcuts-menu__list">
                            {filtered.map((shortcut, index) => (
                                <div 
                                    key={index}
                                    ref={(el) => (shortcutRefs.current[index] = el)}
                                    className={`keyboard-shortcuts-menu__item ${
                                        highlightedIndex === index ? "highlighted" : ""
                                    }`}
                                    onClick={() => (onSelect?.(shortcut.keys), onClose())}
                                    onMouseEnter={() => setHighlightedIndex(index)}
                                    role="menuitem"
                                    tabIndex={-1}
                                >
                                    <span className="keyboard-shortcuts-menu__item-label">{shortcut.label}</span>
                                    <span className="keyboard-shortcuts-menu__item-category">{shortcut.category}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};