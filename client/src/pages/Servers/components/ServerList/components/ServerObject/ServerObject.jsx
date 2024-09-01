import Icon from "@mdi/react";
import { mdiDebian, mdiLinux, mdiMicrosoftWindows, mdiServerOutline } from "@mdi/js";
import "./styles.sass";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import { useContext } from "react";

export const loadIcon = (icon) => {
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

export const ServerObject = ({ id, name, nestedLevel, icon, connectToServer, isPVE }) => {

    const { getServerById } = useContext(ServerContext);

    const connect = () => {
        if (isPVE) {
            connectToServer(id);
            return;
        }

        const server = getServerById(id);

        connectToServer(server.id, server.identities[0]);
    }

    return (
        <div className={(isPVE ? "pve-object " : "") + "server-object"} style={{ paddingLeft: `${15 + (nestedLevel * 15)}px` }} data-id={id}
             onDoubleClick={connect}>
            <div className={"system-icon " + (isPVE ? " pve-icon" : "")}>
                <Icon path={isPVE ? icon : loadIcon(icon)} />
            </div>
            <p>{name}</p>
        </div>
    );
};