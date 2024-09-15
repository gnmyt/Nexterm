import React, { useEffect, useState } from "react";
import "./styles.sass";
import Icon from "@mdi/react";
import {
    mdiArchive,
    mdiDotsVertical,
    mdiFile,
    mdiFileDocument,
    mdiFolder,
    mdiImage,
    mdiMovie,
    mdiMusicNote,
} from "@mdi/js";
import ContextMenu from "./components/ContextMenu";

export const FileList = ({ items, updatePath, path, sendOperation, downloadFile, setCurrentFile }) => {
    const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
    const [selectedItem, setSelectedItem] = useState(null);

    const getIconByFileEnding = (ending) => {
        const icons = {
            jpg: mdiImage, jpeg: mdiImage, png: mdiImage, gif: mdiImage, bmp: mdiImage,
            mp3: mdiMusicNote, wav: mdiMusicNote, flac: mdiMusicNote, ogg: mdiMusicNote,
            mp4: mdiMovie, avi: mdiMovie, mov: mdiMovie, mkv: mdiMovie,
            txt: mdiFileDocument, log: mdiFileDocument,
            zip: mdiArchive, rar: mdiArchive, '7z': mdiArchive,
        };
        return icons[ending] || mdiFile;
    };

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
        } else if (item.type === "file" && item.size < 1024 * 1024) {
            setCurrentFile((path.endsWith("/") ? path : path + "/") + item.name);
        } else {
            downloadFile((path.endsWith("/") ? path : path + "/") + item.name);
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
                         onClick={() => handleClick(item)} onContextMenu={(e) => handleContextMenu(e, item)}>
                        <div className="file-name">
                            <Icon
                                path={item.type === "folder" ? mdiFolder : getIconByFileEnding(item.name.split(".").pop())} />
                            <h2 title={item.name}>{item.name.length > 25 ? item.name.substring(0, 25) + "..." : item.name}</h2>
                        </div>
                        <p>{item.type === "file" && convertUnits(item.size)}</p>
                        <p>{new Date(item.last_modified * 1000).toLocaleString()}</p>
                        <Icon path={mdiDotsVertical} onClick={(e) => handleContextMenu(e, item, true)} />
                    </div>
                ))}

            <ContextMenu menuPosition={menuPosition} selectedItem={selectedItem} sendOperation={sendOperation}
                         path={path} updatePath={updatePath} closeContextMenu={closeContextMenu}
                         downloadFile={downloadFile} setCurrentFile={setCurrentFile} />
        </div>
    );
};