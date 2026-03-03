import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import Icon from "@mdi/react";
import { mdiAccount, mdiMagnify, mdiClose, mdiShieldAccount } from "@mdi/js";
import { getRequest } from "@/common/utils/RequestUtil.js";
import { useTranslation } from "react-i18next";
import "./styles.sass";

export const UserSearch = ({
    value = "",
    onChange,
    onSelect,
    placeholder,
    maxResults = 5,
    debounceMs = 300,
    excludeIds = [],
    disabled = false,
    required = false,
    id,
}) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [results, setResults] = useState([]);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
    const [isPositioned, setIsPositioned] = useState(false);
    const [lastSearched, setLastSearched] = useState("");
    
    const containerRef = useRef(null);
    const inputRef = useRef(null);
    const dropdownRef = useRef(null);
    const optionRefs = useRef([]);
    const debounceTimer = useRef(null);

    const excludeIdsKey = useMemo(() => excludeIds.join(","), [excludeIds]);

    const searchUsers = useCallback(async (searchTerm) => {
        if (searchTerm.trim().length < 3) {
            setResults([]);
            setIsOpen(false);
            return;
        }

        try {
            const response = await getRequest(`accounts/search?search=${encodeURIComponent(searchTerm)}`);
            const users = (response.users || [])
                .filter(user => !excludeIds.includes(user.id))
                .slice(0, maxResults);
            
            setResults(users);
            setIsOpen(users.length > 0);
            setLastSearched(searchTerm);
        } catch {
            setResults([]);
            setIsOpen(false);
        }
    }, [maxResults, excludeIdsKey]);

    useEffect(() => {
        if (value === lastSearched) return;

        if (debounceTimer.current) clearTimeout(debounceTimer.current);

        if (!value.trim()) {
            setResults([]);
            setIsOpen(false);
            setLastSearched("");
            return;
        }

        debounceTimer.current = setTimeout(() => searchUsers(value), debounceMs);
        return () => debounceTimer.current && clearTimeout(debounceTimer.current);
    }, [value, debounceMs, searchUsers, lastSearched]);

    useEffect(() => {
        if (!isOpen || !containerRef.current) {
            setIsPositioned(false);
            return;
        }

        const updatePosition = () => {
            const rect = containerRef.current.getBoundingClientRect();
            let top = rect.bottom + 5;

            if (dropdownRef.current) {
                const dropdownHeight = dropdownRef.current.offsetHeight;
                if (top + dropdownHeight > window.innerHeight - 10) {
                    top = rect.top - dropdownHeight - 5;
                }
            }

            setPosition({ top, left: rect.left, width: rect.width });
            setIsPositioned(true);
        };

        requestAnimationFrame(updatePosition);
        window.addEventListener("scroll", updatePosition, true);
        window.addEventListener("resize", updatePosition, true);

        return () => {
            window.removeEventListener("scroll", updatePosition, true);
            window.removeEventListener("resize", updatePosition, true);
        };
    }, [isOpen, results]);

    useEffect(() => {
        const handleOutsideClick = (e) => {
            if (containerRef.current?.contains(e.target) || dropdownRef.current?.contains(e.target)) return;
            setIsOpen(false);
        };

        document.addEventListener("mousedown", handleOutsideClick);
        return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                setIsOpen(false);
            } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlightedIndex(prev => {
                    const idx = prev < results.length - 1 ? prev + 1 : 0;
                    optionRefs.current[idx]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
                    return idx;
                });
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlightedIndex(prev => {
                    const idx = prev > 0 ? prev - 1 : results.length - 1;
                    optionRefs.current[idx]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
                    return idx;
                });
            } else if (e.key === "Enter" && highlightedIndex >= 0 && highlightedIndex < results.length) {
                e.preventDefault();
                handleSelect(results[highlightedIndex]);
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, highlightedIndex, results]);

    const handleSelect = (user) => {
        onChange?.(user.username);
        onSelect?.(user);
        setIsOpen(false);
        setResults([]);
        setLastSearched(user.username);
        setHighlightedIndex(-1);
    };

    const handleClear = () => {
        onChange?.("");
        setResults([]);
        setIsOpen(false);
        setLastSearched("");
        setHighlightedIndex(-1);
        inputRef.current?.focus();
    };

    return (
        <div className="user-search" ref={containerRef}>
            <div className="user-search__input-container">
                <Icon path={mdiMagnify} className="user-search__icon" />
                <input
                    ref={inputRef}
                    type="text"
                    id={id}
                    name="user-search-input"
                    className="user-search__input"
                    placeholder={placeholder || t("common.userSearch.placeholder")}
                    value={value}
                    onChange={(e) => onChange?.(e.target.value)}
                    onFocus={() => value.trim() && results.length > 0 && setIsOpen(true)}
                    disabled={disabled}
                    required={required}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    data-1p-ignore="true"
                    data-lpignore="true"
                    data-form-type="other"
                />
                {value && !disabled && (
                    <button type="button" className="user-search__clear" onClick={handleClear} tabIndex={-1}>
                        <Icon path={mdiClose} />
                    </button>
                )}
            </div>

            {isOpen && results.length > 0 && createPortal(
                <div
                    ref={dropdownRef}
                    className={`user-search__dropdown ${isPositioned ? "open" : ""}`}
                    style={{ top: position.top, left: position.left, width: position.width }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                >
                    {results.map((user, index) => (
                        <div
                            key={user.id}
                            ref={(el) => (optionRefs.current[index] = el)}
                            className={`user-search__option ${highlightedIndex === index ? "highlighted" : ""}`}
                            onClick={() => handleSelect(user)}
                            onMouseEnter={() => setHighlightedIndex(index)}
                        >
                            <div className={`user-search__avatar ${user.role === "admin" ? "admin" : ""}`}>
                                <Icon path={user.role === "admin" ? mdiShieldAccount : mdiAccount} />
                            </div>
                            <div className="user-search__user-info">
                                <span className="user-search__name">{user.firstName} {user.lastName}</span>
                                <span className="user-search__username">@{user.username}</span>
                            </div>
                            {user.role === "admin" && <span className="user-search__role-badge">Admin</span>}
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
};

export default UserSearch;
