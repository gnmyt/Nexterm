import { useState, useRef, useEffect } from "react";
import Icon from "@mdi/react";
import { mdiMenu, mdiBroadcast, mdiKeyboard, mdiFullscreen, mdiCodeBraces } from "@mdi/js";
import SnippetsMenu from "../../renderer/components/SnippetsMenu";
import KeyboardShortcutsMenu from "./components/KeyboardShortcutsMenu";
import { useKeymaps, matchesKeybind } from "@/common/contexts/KeymapContext.jsx";
import { useTranslation } from "react-i18next";
import "./styles.sass";

export const TerminalActionsMenu = ({ layoutMode, onBroadcastToggle, onSnippetSelected, broadcastEnabled, onKeyboardShortcut, hasGuacamole, fullscreenEnabled, onFullscreenToggle, activeSession }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [showSnippets, setShowSnippets] = useState(false);
    const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
    const menuRef = useRef(null);
    const { getParsedKeybind } = useKeymaps();
    const { t } = useTranslation();

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

            const fullscreenKeybind = getParsedKeybind("fullscreen");
            if (fullscreenKeybind && matchesKeybind(event, fullscreenKeybind)) {
                event.preventDefault();
                onFullscreenToggle?.();
                return;
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
    }, [getParsedKeybind, hasGuacamole, onFullscreenToggle]);

    const handleMenuItemClick = (action) => {
        setMenuOpen(false);
        if (action === "snippets") setShowSnippets(true);
        else if (action === "broadcast") onBroadcastToggle?.();
        else if (action === "keyboard") setShowKeyboardShortcuts(true);
        else if (action === "fullscreen") onFullscreenToggle?.();
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
                title={t('servers.terminalActions.menuTitle')}
                onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(!menuOpen);
                }} 
            />
            
            {menuOpen && (
                <div className="actions-menu-dropdown">
                    <div className="menu-item" onClick={() => handleMenuItemClick("snippets")}>
                        <Icon path={mdiCodeBraces} />
                        <span>{t('servers.terminalActions.snippets')}</span>
                    </div>
                    {hasGuacamole && (
                        <div className="menu-item" onClick={() => handleMenuItemClick("keyboard")}>
                            <Icon path={mdiKeyboard} />
                            <span>{t('servers.terminalActions.keyboardShortcuts')}</span>
                        </div>
                    )}
                    {layoutMode !== "single" && (
                        <div className={`menu-item ${broadcastEnabled ? 'active' : ''}`} onClick={() => handleMenuItemClick("broadcast")}>
                            <Icon path={mdiBroadcast} />
                            <span>{t('servers.terminalActions.broadcasting')}</span>
                            {broadcastEnabled && <span className="badge">{t('servers.terminalActions.badgeOn')}</span>}
                        </div>
                    )}
                    <div className={`menu-item ${fullscreenEnabled ? 'active' : ''}`} onClick={() => handleMenuItemClick("fullscreen")}>
                        <Icon path={mdiFullscreen} />
                        <span>{t('servers.terminalActions.fullScreen')}</span>
                        {fullscreenEnabled && <span className="badge">{t('servers.terminalActions.badgeOn')}</span>}
                    </div>
                </div>
            )}

            <SnippetsMenu 
                visible={showSnippets}
                onClose={() => setShowSnippets(false)}
                onSelect={handleSnippetSelect}
                activeSession={activeSession}
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
