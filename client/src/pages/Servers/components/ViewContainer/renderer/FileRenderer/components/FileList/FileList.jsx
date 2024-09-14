import "./styles.sass";
import Icon from "@mdi/react";
import { mdiDotsVertical, mdiFile, mdiFolder } from "@mdi/js";

export const FileList = ({ items, updatePath, path }) => {

    const convertUnits = (bytes) => {
        const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
        if (bytes === 0) return "0 Byte";
        const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        return Math.round(bytes / Math.pow(1024, i), 2) + " " + sizes[i];
    }

    const handleClick = (item) => {
        if (item.type === "folder") {
            const pathArray = (path.endsWith("/") ? path : path + "/") + item.name;
            updatePath(pathArray);
        }
    }

    return (
        <div className="file-list">
            {items.sort((a, b) => b.type.localeCompare(a.type))
                .map((item, index) => (
                <div key={index} className="file-item" style={{cursor: item.type === "folder" ? "pointer" : "default"}}
                        onClick={() => handleClick(item)}>
                    <div className="file-name">
                        <Icon path={item.type === "folder" ? mdiFolder : mdiFile} />
                        <h2>{item.name}</h2>
                    </div>
                    <p>{item.type === "file" && convertUnits(item.size)}</p>
                    <p>{new Date(item.last_modified*1000).toLocaleString()}</p>
                    <Icon path={mdiDotsVertical} />
                </div>
            ))}
        </div>
    );
};