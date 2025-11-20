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
import { useContext, useRef, useState } from "react";
import { useDrag, useDrop } from "react-dnd";
import { patchRequest } from "@/common/utils/RequestUtil.js";
import { DropIndicator } from "../DropIndicator";

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
    const { loadServers, getServerById } = useContext(ServerContext);
    const [dropPlacement, setDropPlacement] = useState(null);
    const elementRef = useRef(null);

    const [{ opacity }, dragRef] = useDrag({
        item: { type: "server", id, folderId, position },
        type: "server",
        collect: monitor => ({
            opacity: monitor.isDragging() ? 0.5 : 1,
        }),
    });

    const [{ isOver }, dropRef] = useDrop({
        accept: "server",
        hover: (item, monitor) => {
            if (!elementRef.current || item.id === id) return;
            
            const hoverBoundingRect = elementRef.current.getBoundingClientRect();
            const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
            const clientOffset = monitor.getClientOffset();
            const hoverClientY = clientOffset.y - hoverBoundingRect.top;

            const placement = hoverClientY < hoverMiddleY ? 'before' : 'after';
            setDropPlacement(placement);
        },
        drop: async (item) => {
            if (item.id === id) return;
            
            try {
                await patchRequest(`entries/${item.id}/reposition`, {
                    targetId: id,
                    placement: dropPlacement || 'after',
                    folderId: folderId,
                });
                
                loadServers();
            } catch (error) {
                console.error("Failed to reposition entry", error);
            }
            
            setDropPlacement(null);
            return { id };
        },
        collect: (monitor) => ({
            isOver: monitor.isOver(),
        }),
    });

    const server = getServerById(id);

    const connect = () => {
        connectToServer(server.id, server.identities?.[0]);
    };

    return (
        <div 
            className={"server-object"}
            style={{ paddingLeft: `${15 + (nestedLevel * 15)}px`, opacity, position: 'relative' }} 
            data-id={id}
            ref={(node) => {
                elementRef.current = node;
                dragRef(dropRef(node));
            }}
            onDoubleClick={connect}
            onMouseLeave={() => setDropPlacement(null)}>
            <DropIndicator show={isOver && dropPlacement === 'before'} placement="before" />
            <div className="system-icon">
                <Icon path={loadIcon(icon)} />
            </div>
            <p className="truncate-text">{name}</p>
            <DropIndicator show={isOver && dropPlacement === 'after'} placement="after" />
        </div>
    );
};