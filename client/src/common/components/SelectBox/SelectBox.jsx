import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import "./styles.sass";
import Icon from "@mdi/react";
import { mdiChevronDown, mdiMagnify } from "@mdi/js";
import { useTranslation } from "react-i18next";

export const SelectBox = ({ options, selected, setSelected, id, disabled = false, searchable = false }) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
    const [searchTerm, setSearchTerm] = useState("");
    const selectBoxRef = useRef(null);
    const searchInputRef = useRef(null);

    const findSelected = (selected) => {
        return options.findIndex((option) => option.value === selected);
    }

    const handleOptionClick = (option) => {
        setSelected(option);
        setSearchTerm("");
        setIsOpen(false);
    };

    const filteredOptions = searchable && searchTerm
        ? options.filter(opt => opt.label.toLowerCase().includes(searchTerm.toLowerCase()))
        : options;

    const updatePosition = () => {
        if (selectBoxRef.current) {
            const rect = selectBoxRef.current.getBoundingClientRect();
            setPosition({ top: rect.top + rect.height + 5, left: rect.left, width: rect.width });
        }
    };

    useEffect(() => {
        if (options.length > 0 && !selected) setSelected(options[0].value);
    }, [selected]);

    useEffect(() => {
        if (isOpen && searchable && searchInputRef.current) {
            searchInputRef.current.focus();
        }
        if (!isOpen) setSearchTerm("");
    }, [isOpen, searchable]);

    useEffect(() => {
        const handleOutsideClick = (event) => {
            if (selectBoxRef.current && !selectBoxRef.current.contains(event.target) && 
                !document.getElementById('select-box-portal')?.contains(event.target)) {
                setIsOpen(false);
            }
        };

        const handleScroll = () => {
            if (isOpen) {
                updatePosition();
            }
        };

        if (isOpen) {
            updatePosition();
            window.addEventListener('scroll', handleScroll, true);
            window.addEventListener('resize', handleScroll, true);
        }

        document.addEventListener("click", handleOutsideClick);

        return () => {
            document.removeEventListener("click", handleOutsideClick);
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleScroll, true);
        };
    }, [isOpen]);

    const handleDropdownClick = (event) => event.stopPropagation();

    return (
        <div className={`select-box ${disabled ? 'disabled' : ''}`} ref={selectBoxRef}>
            <div className="select-box__selected" onClick={() => !disabled && setIsOpen(!isOpen)}>
                {selected && findSelected(selected) !== -1 ? 
                    options[findSelected(selected)].label : 
                    (options.length > 0 ? options[0].label : t('common.selectBox.defaultOption'))
                }
                <Icon className={`select-box__arrow ${isOpen ? "open" : ""}`} path={mdiChevronDown} />
            </div>
            {isOpen && createPortal(
                <div 
                    className="select-box__options" 
                    id={id || 'select-box-portal'}
                    style={{ top: `${position.top}px`, left: `${position.left}px`,
                        width: `${position.width}px` }}
                    onClick={handleDropdownClick}
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
                            <div key={index} className={`select-box__option ${
                                  selected && findSelected(selected) !== -1 && options[findSelected(selected)].value === option.value ? "selected" : ""}`}
                                onClick={(e) => handleOptionClick(option.value, e)}
                            >{option.label}</div>
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
