import Icon from "@mdi/react";
import { mdiDebian, mdiLinux, mdiMicrosoftWindows, mdiServerOutline } from "@mdi/js";
import "./styles.sass";

const loadIcon = (icon) => {
    switch (icon) {
        case "windows":
            return mdiMicrosoftWindows;
        case "linux":
            return mdiLinux;
        case "debian":
            return mdiDebian;
        default:
            return mdiServerOutline;
    }
};

export const ServerObject = ({ id, name, nestedLevel, icon }) => {
    return (
        <div className="server-object" style={{ paddingLeft: `${15 + (nestedLevel * 15)}px` }} data-id={id}>
            <div className="system-icon">
                <Icon path={loadIcon(icon)} />
            </div>
            <p>{name}</p>
        </div>
    );
};