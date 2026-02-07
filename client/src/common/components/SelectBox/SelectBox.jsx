import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import "./styles.sass";
import Icon from "@mdi/react";
import { mdiChevronDown, mdiMagnify, mdiClose } from "@mdi/js";
import { useTranslation } from "react-i18next";

export const SelectBox = ({ options, selected, setSelected, id, disabled = false, searchable = false, multiple = false, placeholder, invalid = false }) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [adjustedPosition, setAdjustedPosition] = useState({ top: 0, left: 0, width: 0 });
    const [searchTerm, setSearchTerm] = useState("");
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [isPositioned, setIsPositioned] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const selectBoxRef = useRef(null);
    const searchInputRef = useRef(null);
    const optionsRef = useRef(null);
    const optionRefs = useRef([]);

    const selectedArray = multiple ? (Array.isArray(selected) ? selected : []) : null;
    const findSelected = (val) => options.findIndex((o) => o.value === val);
    const filteredOptions = searchable && searchTerm ? options.filter(o => o.label.toLowerCase().includes(searchTerm.toLowerCase())) : options;
    const selectedOption = !multiple && selected && findSelected(selected) !== -1 ? options[findSelected(selected)] : (!multiple && options.length > 0 ? options[0] : null);
    const hasIconProperty = selectedOption?.icon;

    const handleOptionClick = (option) => {
        if (multiple) {
            setSelected(selectedArray.includes(option) ? selectedArray.filter(v => v !== option) : [...selectedArray, option]);
        } else {
            setSelected(option);
            setSearchTerm("");
            setHighlightedIndex(-1);
            setIsOpen(false);
        }
    };

    const removeChip = (value, e) => { e.stopPropagation(); multiple && setSelected(selectedArray.filter(v => v !== value)); };
    const clearAll = (e) => { e.stopPropagation(); multiple && setSelected([]); };
    const isOptionSelected = (val) => multiple ? selectedArray.includes(val) : selected && findSelected(selected) !== -1 && options[findSelected(selected)].value === val;

    useEffect(() => {
        if (isOpen) {
            if (selectBoxRef.current) {
                const rect = selectBoxRef.current.getBoundingClientRect();
                const initialPosition = { 
                    top: rect.top + rect.height + 5, 
                    left: rect.left, 
                    width: selectBoxRef.current.offsetWidth 
                };

                requestAnimationFrame(() => {
                    setIsVisible(true);
                    requestAnimationFrame(() => {
                        if (!optionsRef.current) {
                            setAdjustedPosition(initialPosition);
                            setIsPositioned(true);
                            return;
                        }
                        
                        const menuRect = optionsRef.current.getBoundingClientRect();
                        const { innerWidth, innerHeight } = window;
                        let { top, left, width } = initialPosition;

                        if (left + menuRect.width > innerWidth - 10) left = innerWidth - menuRect.width - 10;
                        if (left < 10) left = 10;

                        if (top + menuRect.height > innerHeight - 10) {
                            const topPosition = rect.top - menuRect.height - 5;
                            if (topPosition >= 10) {
                                top = topPosition;
                            } else {
                                top = innerHeight - menuRect.height - 10;
                            }
                        }
                        if (top < 10) top = 10;

                        setAdjustedPosition({ top, left, width });
                        setIsPositioned(true);
                    });
                });
            }
        } else {
            setIsPositioned(false);
            setSearchTerm("");
            setHighlightedIndex(-1);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!multiple && options.length > 0 && !selected) setSelected(options[0].value);
    }, [selected, multiple]);

    useEffect(() => {
        if (isOpen && searchable && searchInputRef.current) searchInputRef.current.focus();
        if (isOpen && !searchable && !multiple) {
            const idx = findSelected(selected);
            setHighlightedIndex(idx !== -1 ? idx : 0);
        }
    }, [isOpen, searchable, selected]);

    useEffect(() => {
        const handleOutsideClick = (event) => {
            if (selectBoxRef.current && !selectBoxRef.current.contains(event.target) && 
                !optionsRef.current?.contains(event.target)) {
                setIsOpen(false);
            }
        };

        const handleScroll = () => {
            if (isOpen && isPositioned && selectBoxRef.current && optionsRef.current) {
                const rect = selectBoxRef.current.getBoundingClientRect();
                const menuRect = optionsRef.current.getBoundingClientRect();
                const { innerWidth, innerHeight } = window;
                
                let top = rect.top + rect.height + 5;
                let left = rect.left;
                const width = selectBoxRef.current.offsetWidth;

                left = Math.max(10, Math.min(left, innerWidth - menuRect.width - 10));

                if (top + menuRect.height > innerHeight - 10) {
                    top = rect.top - menuRect.height - 5;
                }
                top = Math.max(10, top);

                setAdjustedPosition({ top, left, width });
            }
        };

        const handleKeyDown = (e) => {
            if (!isOpen) return;

            if (e.key === "Escape") {
                e.preventDefault();
                setIsOpen(false);
                return;
            }

            if (searchable && searchInputRef.current === document.activeElement) {
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    searchInputRef.current.blur();
                    setHighlightedIndex(0);
                }
                return;
            }

            if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlightedIndex((prev) => {
                    const newIndex = prev < filteredOptions.length - 1 ? prev + 1 : 0;
                    optionRefs.current[newIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
                    return newIndex;
                });
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlightedIndex((prev) => {
                    const newIndex = prev > 0 ? prev - 1 : filteredOptions.length - 1;
                    optionRefs.current[newIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
                    return newIndex;
                });
            } else if (e.key === "Enter" && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
                e.preventDefault();
                handleOptionClick(filteredOptions[highlightedIndex].value);
            }
        };

        if (isOpen) {
            window.addEventListener('scroll', handleScroll, true);
            window.addEventListener('resize', handleScroll, true);
            document.addEventListener("keydown", handleKeyDown);
        }

        document.addEventListener("mousedown", handleOutsideClick);

        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleScroll, true);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen, isPositioned, highlightedIndex, filteredOptions, searchable, multiple]);

    const handleDropdownClick = (e) => e.stopPropagation();
    const handleAnimationEnd = (e) => e?.target === optionsRef.current && !isOpen && setIsVisible(false);

    const renderSelectedContent = () => {
        if (multiple) {
            if (selectedArray.length === 0) return <span className="select-box__placeholder">{placeholder || t('common.selectBox.defaultOption')}</span>;
            return (
                <div className="select-box__chips">
                    {selectedArray.slice(0, 3).map(value => (
                        <span key={value} className="select-box__chip">
                            {options.find(o => o.value === value)?.label || value}
                            <button type="button" className="select-box__chip-remove" onClick={(e) => removeChip(value, e)}><Icon path={mdiClose} /></button>
                        </span>
                    ))}
                    {selectedArray.length > 3 && <span className="select-box__chip select-box__chip--more">+{selectedArray.length - 3}</span>}
                </div>
            );
        }
        return (
            <>
                {hasIconProperty && <Icon className="select-box__option-icon" path={selectedOption.icon} />}
                {selectedOption ? selectedOption.label : t('common.selectBox.defaultOption')}
            </>
        );
    };
    
    return (
        <div className={`select-box ${disabled ? 'disabled' : ''} ${multiple ? 'select-box--multiple' : ''} ${invalid ? 'invalid' : ''}`} ref={selectBoxRef}>
            <div className="select-box__selected" onClick={() => !disabled && setIsOpen(!isOpen)}>
                <div className={`select-box__selected-content ${!hasIconProperty && !multiple ? 'icon-only' : ''}`}>
                    {renderSelectedContent()}
                </div>
                <div className="select-box__actions">
                    {multiple && selectedArray.length > 0 && (
                        <button type="button" className="select-box__clear" onClick={clearAll}>
                            <Icon path={mdiClose} />
                        </button>
                    )}
                    <Icon className={`select-box__arrow ${isOpen ? "open" : ""}`} path={mdiChevronDown} />
                </div>
            </div>
            {isVisible && createPortal(
                <div 
                    ref={optionsRef}
                    className={`select-box__options ${isOpen && isPositioned ? 'open' : 'closed'}`}
                    id={id || 'select-box-portal'}
                    style={{ 
                        top: `${adjustedPosition.top}px`, 
                        left: `${adjustedPosition.left}px`,
                        minWidth: `${adjustedPosition.width}px`
                    }}
                    onClick={handleDropdownClick}
                    onTransitionEnd={handleAnimationEnd}
                    role="menu"
                    aria-orientation="vertical"
                >
                    {searchable && (
                        <div className="select-box__search">
                            <Icon path={mdiMagnify} />
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder={t('common.selectBox.search')}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    )}
                    <div className="select-box__options-scroll">
                        {filteredOptions.length > 0 ? filteredOptions.map((option, index) => (
                            <div 
                                key={index} 
                                ref={(el) => (optionRefs.current[index] = el)}
                                className={`select-box__option ${!option.icon && !multiple ? 'icon-only' : ''} ${isOptionSelected(option.value) ? "selected" : ""} ${highlightedIndex === index ? "highlighted" : ""}`}
                                onClick={() => handleOptionClick(option.value)}
                                onMouseEnter={() => setHighlightedIndex(index)}
                                role="menuitem"
                                tabIndex={-1}
                            >
                                {multiple && (
                                    <div className={`select-box__checkbox ${isOptionSelected(option.value) ? 'checked' : ''}`}>
                                        <svg viewBox="0 0 24 24"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
                                    </div>
                                )}
                                {option.icon && <Icon className="select-box__option-icon" path={option.icon} />}
                                <span className="select-box__option-label">{option.label}</span>
                            </div>
                        )) : (
                            <div className="select-box__no-results">{t('common.selectBox.noResults')}</div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
