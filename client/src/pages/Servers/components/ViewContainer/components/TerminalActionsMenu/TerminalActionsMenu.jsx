import { useState, useRef, useEffect } from "react";
import Icon from "@mdi/react";
import { mdiMenu, mdiBroadcast, mdiCodeArray, mdiKeyboard } from "@mdi/js";
import SnippetsMenu from "../../renderer/components/SnippetsMenu";
import KeyboardShortcutsMenu from "./components/KeyboardShortcutsMenu";
import { useKeymaps, matchesKeybind } from "@/common/contexts/KeymapContext.jsx";
import "./styles.sass";

export const TerminalActionsMenu = ({ layoutMode, onBroadcastToggle, onSnippetSelected, broadcastEnabled, onKeyboardShortcut, hasGuacamole }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [showSnippets, setShowSnippets] = useState(false);
    const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
    const menuRef = useRef(null);
    const { getParsedKeybind } = useKeymaps();

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setMenuOpen(false);
            }
        };

        if (menuOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [menuOpen]);

    useEffect(() => {
        const handleKeyPress = (event) => {
            const snippetsKeybind = getParsedKeybind("snippets");
            if (snippetsKeybind && matchesKeybind(event, snippetsKeybind)) {
                event.preventDefault();
                setShowSnippets(true);
                return;
            }

            if (hasGuacamole) {
                const keyboardShortcutsKeybind = getParsedKeybind("keyboard-shortcuts");
                if (keyboardShortcutsKeybind && matchesKeybind(event, keyboardShortcutsKeybind)) {
                    event.preventDefault();
                    setShowKeyboardShortcuts(true);
                    return;
                }
            }
        };

        const handleSnippetsShortcut = () => setShowSnippets(true);
        const handleKeyboardShortcutsShortcut = () => {
            if (hasGuacamole) {
                setShowKeyboardShortcuts(true);
            }
        };

        document.addEventListener("keydown", handleKeyPress);
        window.addEventListener('terminal-snippets-shortcut', handleSnippetsShortcut);
        window.addEventListener('terminal-keyboard-shortcuts-shortcut', handleKeyboardShortcutsShortcut);
        
        return () => {
            document.removeEventListener("keydown", handleKeyPress);
            window.removeEventListener('terminal-snippets-shortcut', handleSnippetsShortcut);
            window.removeEventListener('terminal-keyboard-shortcuts-shortcut', handleKeyboardShortcutsShortcut);
        };
    }, [getParsedKeybind, hasGuacamole]);

    const handleMenuItemClick = (action) => {
        setMenuOpen(false);
        if (action === "snippets") setShowSnippets(true);
        else if (action === "broadcast") onBroadcastToggle?.();
        else if (action === "keyboard") setShowKeyboardShortcuts(true);
    };

    const handleSnippetSelect = (command) => {
        setShowSnippets(false);
        setTimeout(() => onSnippetSelected?.(command), 50);
    };

    return (
        <div className="terminal-actions-menu" ref={menuRef}>
            <Icon 
                path={mdiMenu} 
                className={`actions-menu-btn ${menuOpen ? 'active' : ''}`}
                title="Terminal Actions" 
                onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(!menuOpen);
                }} 
            />
            
            {menuOpen && (
                <div className="actions-menu-dropdown">
                    <div className="menu-item" onClick={() => handleMenuItemClick("snippets")}>
                        <Icon path={mdiCodeArray} />
                        <span>Snippets</span>
                    </div>
                    {hasGuacamole && (
                        <div className="menu-item" onClick={() => handleMenuItemClick("keyboard")}>
                            <Icon path={mdiKeyboard} />
                            <span>Keyboard Shortcuts</span>
                        </div>
                    )}
                    {layoutMode !== "single" && (
                        <div className={`menu-item ${broadcastEnabled ? 'active' : ''}`} onClick={() => handleMenuItemClick("broadcast")}>
                            <Icon path={mdiBroadcast} />
                            <span>Broadcasting</span>
                            {broadcastEnabled && <span className="badge">ON</span>}
                        </div>
                    )}
                </div>
            )}

            <SnippetsMenu 
                visible={showSnippets}
                onClose={() => setShowSnippets(false)}
                onSelect={handleSnippetSelect}
            />

            <KeyboardShortcutsMenu
                visible={showKeyboardShortcuts}
                onClose={() => setShowKeyboardShortcuts(false)}
                onSelect={onKeyboardShortcut}
            />
        </div>
    );
};

export default TerminalActionsMenu;
