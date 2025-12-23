import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import "./styles.sass";
import Icon from "@mdi/react";
import { mdiChevronDown, mdiMagnify } from "@mdi/js";
import { useTranslation } from "react-i18next";

export const SelectBox = ({ options, selected, setSelected, id, disabled = false, searchable = false }) => {
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

    const findSelected = (selected) => {
        return options.findIndex((option) => option.value === selected);
    }

    const handleOptionClick = (option) => {
        setSelected(option);
        setSearchTerm("");
        setHighlightedIndex(-1);
        setIsOpen(false);
    };

    const filteredOptions = searchable && searchTerm
        ? options.filter(opt => opt.label.toLowerCase().includes(searchTerm.toLowerCase()))
        : options;

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
        }
    }, [isOpen]);

    const handleAnimationEnd = (e) => {
        if (e && e.target === optionsRef.current && !isOpen) {
            setIsVisible(false);
        }
    };

    useEffect(() => {
        if (!isOpen) setIsPositioned(false);

    }, [isOpen]);

    useEffect(() => {
        if (options.length > 0 && !selected) setSelected(options[0].value);
    }, [selected]);

    useEffect(() => {
        if (isOpen && searchable && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isOpen, searchable]);

    useEffect(() => {
        if (!isOpen) {
            setSearchTerm("");
            setHighlightedIndex(-1);
        } else if (!searchable) {
            const selectedIdx = findSelected(selected);
            setHighlightedIndex(selectedIdx !== -1 ? selectedIdx : 0);
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
    }, [isOpen, isPositioned, highlightedIndex, filteredOptions, searchable]);

    const handleDropdownClick = (event) => event.stopPropagation();

    const selectedOption = selected && findSelected(selected) !== -1 ? options[findSelected(selected)] : (options.length > 0 ? options[0] : null);
    const hasIconProperty = selectedOption?.icon;
    
    return (
        <div className={`select-box ${disabled ? 'disabled' : ''}`} ref={selectBoxRef}>
            <div className="select-box__selected" onClick={() => !disabled && setIsOpen(!isOpen)}>
                <div className={`select-box__selected-content ${!hasIconProperty ? 'icon-only' : ''}`}>
                    {hasIconProperty && (
                        <Icon className="select-box__option-icon" path={selectedOption.icon} />
                    )}
                    {selectedOption ? selectedOption.label : t('common.selectBox.defaultOption')}
                </div>
                <Icon className={`select-box__arrow ${isOpen ? "open" : ""}`} path={mdiChevronDown} />
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
                                className={`select-box__option ${!option.icon ? 'icon-only' : ''} ${
                                    selected && findSelected(selected) !== -1 && options[findSelected(selected)].value === option.value ? "selected" : ""
                                } ${highlightedIndex === index ? "highlighted" : ""}`}
                                onClick={(e) => handleOptionClick(option.value, e)}
                                onMouseEnter={() => setHighlightedIndex(index)}
                                role="menuitem"
                                tabIndex={-1}
                            >
                                {option.icon && <Icon className="select-box__option-icon" path={option.icon} />}
                                {option.icon ? (
                                    <span className="select-box__option-label">{option.label}</span>
                                ) : (
                                    option.label
                                )}
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
