import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import "./styles.sass";
import Icon from "@mdi/react";
import { mdiChevronDown } from "@mdi/js";

export const SelectBox = ({ options, selected, setSelected, id, disabled = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
    const selectBoxRef = useRef(null);

    const findSelected = (selected) => {
        return options.findIndex((option) => option.value === selected);
    }

    const handleOptionClick = (option) => {
        setSelected(option);
        setIsOpen(false);
    };

    const updatePosition = () => {
        if (selectBoxRef.current) {
            const rect = selectBoxRef.current.getBoundingClientRect();
            setPosition({ top: rect.top + rect.height + 5, left: rect.left, width: rect.width });
        }
    };

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
                    (options.length > 0 ? options[0].label : "Select an option...")
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
                    <div className="select-box__options-scroll">
                        {options.map((option, index) => (
                            <div key={index} className={`select-box__option ${
                                  selected && options[findSelected(selected)].value === option.value ? "selected" : ""}`}
                                onClick={(e) => handleOptionClick(option.value, e)}
                            >{option.label}</div>
                        ))}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
