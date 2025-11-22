import { useSnippets } from "@/common/contexts/SnippetContext.jsx";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import "./styles.sass";
import { mdiClose, mdiMagnify } from "@mdi/js";
import Icon from "@mdi/react";

export const SnippetsMenu = ({ onSelect, onClose, visible }) => {
    const { snippets } = useSnippets();
    const [search, setSearch] = useState("");
    const searchRef = useRef(null);

    useEffect(() => {
        if (visible && searchRef.current) {
            searchRef.current.focus();
        }
    }, [visible]);

    const handleSnippetClick = (snippet) => {
        onSelect(snippet.command);
        onClose();
    };

    const handleSearch = (e) => {
        setSearch(e.target.value);
    };

    const filteredSnippets = () => {
        if (!snippets || snippets.length === 0) return [];
        if (!search) return snippets;

        const searchLower = search.toLowerCase();
        return snippets.filter(snippet =>
            snippet.name.toLowerCase().includes(searchLower) ||
            snippet.command.toLowerCase().includes(searchLower) ||
            (snippet.description && snippet.description.toLowerCase().includes(searchLower)),
        );
    };

    if (!visible) return null;

    const filtered = filteredSnippets();

    const menu = (
        <div className="snippets-menu-overlay" onClick={onClose}>
            <div onClick={(e) => e.stopPropagation()}>
                <div className="snippets-menu snippets-menu-popover">
                    <div className="snippets-menu-header">
                        <div className="search-wrapper">
                            <Icon path={mdiMagnify} />
                            <input type="text" placeholder="Search snippets..." value={search} onChange={handleSearch}
                                   ref={searchRef} />
                        </div>
                        <button className="close-button" onClick={onClose}>
                            <Icon path={mdiClose} />
                        </button>
                    </div>

                    <div className="snippets-menu-content">
                        {filtered.length === 0 ? (
                            <div className="no-snippets">
                                {snippets?.length === 0 ? (
                                    <p>No snippets available. Create some in the Snippets section.</p>
                                ) : (
                                    <p>No snippets match your search.</p>
                                )}
                            </div>
                        ) : (
                            <div className="snippets-list">
                                {filtered.map(snippet => (
                                    <div key={snippet.id} className="snippet-item" onClick={() => handleSnippetClick(snippet)}>
                                        <h4>{snippet.name}</h4>
                                        {snippet.description && <p className="snippet-description">{snippet.description}</p>}
                                        <pre className="snippet-command">{snippet.command}</pre>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(menu, document.body);
};