import React, { useEffect, useState } from "react";
import "./styles.sass";
import Icon from "@mdi/react";
import { mdiChevronDown } from "@mdi/js";

export const SelectBox = ({ options, selected, setSelected, id }) => {
    const [isOpen, setIsOpen] = useState(false);

    const findSelected = (selected) => {
        return options.findIndex((option) => option.value === selected);
    }

    const handleOptionClick = (option) => {
        setSelected(option);
        setIsOpen(false);
    };

    useEffect(() => {
        if (!selected) {
            setSelected(options[0].value);
        }
    }, [selected]);

    useEffect(() => {
        const handleOutsideClick = (event) => {
            if (!event.target.closest(".select-box")) {
                setIsOpen(false);
            }
        };

        document.addEventListener("click", handleOutsideClick);

        return () => {
            document.removeEventListener("click", handleOutsideClick);
        };
    }, []);

    return (
        <div className="select-box">
            <div className="select-box__selected" onClick={() => setIsOpen(!isOpen)}>
                {selected && findSelected(selected) !== -1 && options[findSelected(selected)].label}
                <Icon className={`select-box__arrow ${isOpen ? "open" : ""}`} path={mdiChevronDown} />
            </div>
            {isOpen && (
                <div className="select-box__options" id={id}>
                    {options.map((option, index) => (
                        <div key={index} className={`select-box__option ${
                                selected && options[findSelected(selected)].value === option.value ? "selected" : ""}`}
                            onClick={() => handleOptionClick(option.value)}
                        >{option.label}</div>
                    ))}
                </div>
            )}
        </div>
    );
};
