import { useState, useRef, useEffect } from "react";
import Icon from "@mdi/react";
import { mdiClose, mdiMagnify } from "@mdi/js";
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
    const searchRef = useRef(null);

    useEffect(() => {
        if (visible && searchRef.current) {
            searchRef.current.focus();
        }
    }, [visible]);

    const handleShortcutClick = (shortcut) => {
        if (onSelect) {
            onSelect(shortcut.keys);
        }
        onClose();
    };

    const handleSearch = (e) => {
        setSearch(e.target.value);
    };

    const filteredShortcuts = () => {
        if (!search) return KEYBOARD_SHORTCUTS;

        const searchLower = search.toLowerCase();
        return KEYBOARD_SHORTCUTS.filter(shortcut =>
            shortcut.label.toLowerCase().includes(searchLower) ||
            shortcut.category.toLowerCase().includes(searchLower)
        );
    };

    if (!visible) return null;

    const filtered = filteredShortcuts();

    const menuContent = (
        <div className="keyboard-shortcuts-menu">
            <div className="keyboard-shortcuts-header">
                <div className="search-wrapper">
                    <Icon path={mdiMagnify} />
                    <input 
                        type="text" 
                        placeholder="Search shortcuts..." 
                        value={search} 
                        onChange={handleSearch}
                        ref={searchRef} 
                    />
                </div>
                <button className="close-button" onClick={onClose}>
                    <Icon path={mdiClose} />
                </button>
            </div>

            <div className="keyboard-shortcuts-content">
                {filtered.length === 0 ? (
                    <div className="no-shortcuts">
                        <p>No shortcuts match your search.</p>
                    </div>
                ) : (
                    <div className="shortcuts-list">
                        {filtered.map((shortcut, index) => (
                            <div key={index} className="shortcut-item" onClick={() => handleShortcutClick(shortcut)}>
                                <div className="shortcut-info">
                                    <h4>{shortcut.label}</h4>
                                    <span className="shortcut-category">{shortcut.category}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="keyboard-shortcuts-overlay" onClick={onClose}>
            <div onClick={(e) => e.stopPropagation()}>
                {menuContent}
            </div>
        </div>
    );
};