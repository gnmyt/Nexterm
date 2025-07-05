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
    mdiAlertCircle,
} from "@mdi/js";
import ContextMenu from "./components/ContextMenu";

export const FileList = ({ items, updatePath, path, sendOperation, downloadFile, setCurrentFile, loading, viewMode = "list", error }) => {
    const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
    const [selectedItem, setSelectedItem] = useState(null);
    const [focusedIndex, setFocusedIndex] = useState(-1);

    const getIconByFileEnding = (ending) => {
        const icons = {
            jpg: mdiImage, jpeg: mdiImage, png: mdiImage, gif: mdiImage, bmp: mdiImage,
            mp3: mdiMusicNote, wav: mdiMusicNote, flac: mdiMusicNote, ogg: mdiMusicNote,
            mp4: mdiMovie, avi: mdiMovie, mov: mdiMovie, mkv: mdiMovie,
            txt: mdiFileDocument, log: mdiFileDocument, md: mdiFileDocument,
            zip: mdiArchive, rar: mdiArchive, '7z': mdiArchive,
        };
        return icons[ending] || mdiFile;
    };

    const getIconColor = (item) => {
        if (item.type === "folder") return "";

        const ending = item.name.split(".").pop()?.toLowerCase();
        const colorMap = {
            jpg: "#ff6b6b", jpeg: "#ff6b6b", png: "#ff6b6b", gif: "#ff6b6b", bmp: "#ff6b6b",
            mp3: "#51cf66", wav: "#51cf66", flac: "#51cf66", ogg: "#51cf66",
            mp4: "#ffa500", avi: "#ffa500", mov: "#ffa500", mkv: "#ffa500",
            txt: "#74c0fc", log: "#74c0fc", md: "#74c0fc",
            zip: "#ffd43b", rar: "#ffd43b", "7z": "#ffd43b",
        };
        return colorMap[ending] || "#adb5bd";
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
        <div className={`file-list ${viewMode}`}>
            {viewMode === "list" && (
                <div className="file-list-header">
                    <div className="header-name">Name</div>
                    <div className="header-size">Size</div>
                    <div className="header-date">Modified</div>
                    <div className="header-actions"></div>
                </div>
            )}
            {loading ? (
                <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Loading files...</p>
                </div>
            ) : error ? (
                <div className="error-state">
                    <Icon path={mdiAlertCircle} />
                    <h3>Access Denied</h3>
                    <p>{error}</p>
                </div>
            ) : items.length === 0 ? (
                <div className="empty-state">
                    <Icon path={mdiFolder} />
                    <h3>This folder is empty</h3>
                    <p>Drop files here to upload them</p>
                </div>
            ) : (
                items
                    .sort((a, b) => b.type.localeCompare(a.type) || a.name.localeCompare(b.name))

                .map((item, index) => (
                    <div 
                        key={index} 
                        className={`file-item ${focusedIndex === index ? 'focused' : ''} ${viewMode}`}
                        onClick={() => handleClick(item)} 
                        onContextMenu={(e) => handleContextMenu(e, item)}
                        onMouseEnter={() => setFocusedIndex(index)}
                        onMouseLeave={() => setFocusedIndex(-1)}
                        tabIndex={0}
                    >
                        <div className="file-name">
                            <Icon
                                path={item.type === "folder" ? mdiFolder : getIconByFileEnding(item.name.split(".").pop()?.toLowerCase())}
                                style={{ color: getIconColor(item) }}
                            />
                            <h2 title={item.name}>{item.name}</h2>
                        </div>
                        {viewMode === "list" && (
                            <>
                                <p className="file-size">{item.type === "file" && convertUnits(item.size)}</p>
                                <p className="file-date">{new Date(item.last_modified * 1000).toLocaleDateString()}</p>
                            </>
                        )}
                        <Icon 
                            path={mdiDotsVertical} 
                            className="dots-menu"
                            onClick={(e) => handleContextMenu(e, item, true)} 
                        />
                    </div>
                ))
            )}

            <ContextMenu menuPosition={menuPosition} selectedItem={selectedItem} sendOperation={sendOperation}
                         path={path} updatePath={updatePath} closeContextMenu={closeContextMenu}
                         downloadFile={downloadFile} setCurrentFile={setCurrentFile} />
        </div>
    );
};