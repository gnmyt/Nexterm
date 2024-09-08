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

export const ServerObject = ({ id, name, nestedLevel, icon, connectToServer, isPVE, status, sshOnly }) => {

    const { getServerById } = useContext(ServerContext);

    const server = getServerById(id);

    const connect = () => {
        if (isPVE && status === "running") {
            connectToServer(id);
            return;
        }

        connectToServer(server.id, server.identities[0]);
    }

    if (sshOnly && server.protocol !== "ssh") {
        return null;
    }

    return (
        <div className={(isPVE ? "pve-entry " : "") + "server-object"} style={{ paddingLeft: `${15 + (nestedLevel * 15)}px` }} data-id={id}
             onDoubleClick={sshOnly ? null : connect} onClick={sshOnly ? connect : null}>
            <div className={"system-icon " + (isPVE ? (status !== "running" ? " pve-icon-offline" : " pve-icon")  : "")}>
                <Icon path={isPVE ? icon : loadIcon(icon)} />
            </div>
            <p>{name}</p>
        </div>
    );
};