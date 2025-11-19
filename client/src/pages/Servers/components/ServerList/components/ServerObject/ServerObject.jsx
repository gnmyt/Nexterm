import Icon from "@mdi/react";
import { 
    mdiDebian, 
    mdiLinux, 
    mdiMicrosoftWindows, 
    mdiServerOutline,
    mdiUbuntu,
    mdiApple,
    mdiDocker,
    mdiKubernetes,
    mdiDatabase,
    mdiCloud,
    mdiRaspberryPi,
    mdiConsole,
    mdiMonitor,
    mdiCube,
    mdiFreebsd
} from "@mdi/js";
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
        case "ubuntu":
            return mdiUbuntu;
        case "arch":
            return mdiLinux;
        case "freebsd":
            return mdiFreebsd;
        case "macos":
            return mdiApple;
        case "docker":
            return mdiDocker;
        case "kubernetes":
            return mdiKubernetes;
        case "database":
            return mdiDatabase;
        case "cloud":
            return mdiCloud;
        case "raspberry":
            return mdiRaspberryPi;
        case "terminal":
            return mdiConsole;
        case "desktop":
            return mdiMonitor;
        case "vm":
            return mdiCube;
        default:
            return mdiServerOutline;
    }
};

export const ServerObject = ({ id, name, position, folderId, nestedLevel, icon, connectToServer, status }) => {
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
        connectToServer(server.id, server.identities?.[0]);
    };

    return (
        <div className={"server-object" + (isOver ? " server-is-over" : "")}
             style={{ paddingLeft: `${15 + (nestedLevel * 15)}px`, opacity }} data-id={id}
             ref={(node) => dragRef(dropRef(node))}
             onDoubleClick={connect}>
            <div className="system-icon">
                <Icon path={loadIcon(icon)} />
            </div>
            <p className="truncate-text">{name}</p>
        </div>
    );
};