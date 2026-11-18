import { createContext, useContext, useEffect, useId, useRef } from "react";

export const SettingsSectionsContext = createContext(null);

export const SettingsHeading = ({ children, ...props }) => {
    const id = useId();
    const ref = useRef(null);
    const sections = useContext(SettingsSectionsContext);

    useEffect(() => {
        sections?.update(id, ref.current);
    });

    useEffect(() => () => sections?.remove(id), [sections, id]);

    return <h2 ref={ref} data-section={id} {...props}>{children}</h2>;
};
