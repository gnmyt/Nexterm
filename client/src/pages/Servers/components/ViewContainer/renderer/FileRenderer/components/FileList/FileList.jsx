import React, { useEffect, useState } from "react";
import "./styles.sass";
import Icon from "@mdi/react";
import { mdiDotsVertical, mdiFile, mdiFolder } from "@mdi/js";
import ContextMenu from "./components/ContextMenu";

export const FileList = ({ items, updatePath, path, sendOperation, serverId, identityId }) => {
    const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
    const [selectedItem, setSelectedItem] = useState(null);

    const convertUnits = (bytes) => {
        const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
        if (bytes === 0) return "0 Byte";
        const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        return Math.round(bytes / Math.pow(1024, i), 2) + " " + sizes[i];
    };

    const handleClick = (item) => {
        if (item.type === "folder") {
            const pathArray = (path.endsWith("/") ? path : path + "/") + item.name;
            updatePath(pathArray);
        }
    };

    const handleContextMenu = (event, item, fromDots = false) => {
        event.preventDefault();

        if (fromDots) {
            event.stopPropagation();
            const dotsRect = event.currentTarget.getBoundingClientRect();
            setMenuPosition({ x: dotsRect.x - 100, y: dotsRect.y + dotsRect.height });
        } else {
            setMenuPosition({ x: event.pageX, y: event.pageY });
        }

        setSelectedItem(item);
    };

    const closeContextMenu = () => {
        setMenuPosition({ x: 0, y: 0 });
    };

    useEffect(() => {
        document.addEventListener("click", closeContextMenu);
        return () => document.removeEventListener("click", closeContextMenu);
    }, []);

    return (
        <div className="file-list">
            {items
                .sort((a, b) => b.type.localeCompare(a.type) || a.name.localeCompare(b.name))

                .map((item, index) => (
                    <div key={index} className="file-item"
                         style={{ cursor: item.type === "folder" ? "pointer" : "default" }}
                         onClick={() => handleClick(item)} onContextMenu={(e) => handleContextMenu(e, item)}>
                        <div className="file-name">
                            <Icon path={item.type === "folder" ? mdiFolder : mdiFile} />
                            <h2>{item.name}</h2>
                        </div>
                        <p>{item.type === "file" && convertUnits(item.size)}</p>
                        <p>{new Date(item.last_modified * 1000).toLocaleString()}</p>
                        <Icon path={mdiDotsVertical} onClick={(e) => handleContextMenu(e, item, true)} />
                    </div>
                ))}

            <ContextMenu menuPosition={menuPosition} selectedItem={selectedItem} sendOperation={sendOperation}
                         path={path} updatePath={updatePath} closeContextMenu={closeContextMenu}
                         serverId={serverId} identityId={identityId} />
        </div>
    );
};