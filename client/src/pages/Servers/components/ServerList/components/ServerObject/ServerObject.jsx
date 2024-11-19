import Icon from "@mdi/react";
import { mdiDebian, mdiLinux, mdiMicrosoftWindows, mdiServerOutline } from "@mdi/js";
import "./styles.sass";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import { useContext } from "react";
import { useDrag, useDrop } from "react-dnd";
import { patchRequest } from "@/common/utils/RequestUtil.js";

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

export const ServerObject = ({ id, name, position, folderId, nestedLevel, icon, connectToServer, isPVE, status, sshOnly }) => {
    const { loadServers, getServerListInFolder } = useContext(ServerContext);

    const [{ opacity }, dragRef] = useDrag({
        item: { type: "server", id, folderId, position },
        type: "server",
        collect: monitor => ({
            opacity: monitor.isDragging() ? 0.5 : 1,
        }),
    });

    const [{ isOver }, dropRef] = useDrop({
        accept: "server",
        drop: async (item) => {
            const servers = getServerListInFolder(folderId);

            const targetIndex = servers.findIndex(server => server.id === id);
            const draggedIndex = servers.findIndex(server => server.id === item.id);

            let newPosition;
            if (targetIndex > draggedIndex) {
                newPosition = (servers[targetIndex].position + (servers[targetIndex + 1]?.position || servers[targetIndex].position + 1)) / 2;
            } else {
                newPosition = (servers[targetIndex].position + (servers[targetIndex - 1]?.position || servers[targetIndex].position - 1)) / 2;
            }

            await patchRequest(`servers/${item.id}`, {
                folderId: item.folderId !== folderId ? folderId : undefined,
                position: Math.max(newPosition, 0),
            });

            loadServers();

            return { id };
        },
        collect: (monitor) => ({
            isOver: monitor.isOver(),
        }),
    });

    const { getServerById } = useContext(ServerContext);

    const server = getServerById(id);

    const connect = () => {
        if (isPVE && status === "running") {
            connectToServer(id);
            return;
        }

        connectToServer(server.id, server.identities[0]);
    };

    if (sshOnly && server.protocol !== "ssh") {
        return null;
    }

    return (
        <div className={(isPVE ? "pve-entry " : "") + "server-object" + (isOver ? " server-is-over" : "")}
             style={{ paddingLeft: `${15 + (nestedLevel * 15)}px`, opacity }} data-id={id}
             ref={!isPVE ? (node) => dragRef(dropRef(node)) : () => {}}
             onDoubleClick={sshOnly ? null : connect} onClick={sshOnly ? connect : null}>
            <div className={"system-icon " + (isPVE ? (status !== "running" ? " pve-icon-offline" : " pve-icon") : "")}>
                <Icon path={isPVE ? icon : loadIcon(icon)} />
            </div>
            <p>{name}</p>
        </div>
    );
};