import "./styles.sass";
import Icon from "@mdi/react";
import {
    mdiConnection,
    mdiFolderPlus,
    mdiFolderRemove,
    mdiFormTextbox,
    mdiPencil,
    mdiServerMinus,
    mdiServerPlus,
} from "@mdi/js";
import { deleteRequest, putRequest } from "@/common/utils/RequestUtil.js";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import { useContext } from "react";

export const ContextMenu = ({ position, id, type }) => {

    const { loadServers } = useContext(ServerContext);

    const createFolder = () => putRequest("folders", {
        name: "New Folder", parentId: id === null ? undefined : id,
    }).then(loadServers);

    const deleteFolder = () => deleteRequest("folders/" + id).then(loadServers);

    const deleteServer = () => deleteRequest("servers/" + id).then(loadServers);

    return (
        <div className="context-menu" style={{ top: position.y, left: position.x }}>
            {type !== "server-object" && <div className="context-item" onClick={createFolder}>
                <Icon path={mdiFolderPlus} />
                <p>Create Folder</p>
            </div>}
            {type === "folder-object" && <>
                <div className="context-item" onClick={deleteFolder}>
                    <Icon path={mdiFolderRemove} />
                    <p>Delete Folder</p>
                </div>
                <div className="context-item">
                    <Icon path={mdiFormTextbox} />
                    <p>Rename Folder</p>
                </div>
                <div className="context-item">
                    <Icon path={mdiServerPlus} />
                    <p>Create Server</p>
                </div>
            </>}
            {type === "server-object" && <>
                <div className="context-item">
                    <Icon path={mdiConnection} />
                    <p>Connect</p>
                </div>
                <div className="context-item">
                    <Icon path={mdiPencil} />
                    <p>Edit Server</p>
                </div>
                <div className="context-item" onClick={deleteServer}>
                    <Icon path={mdiServerMinus} />
                    <p>Delete Server</p>
                </div>
            </>}

        </div>
    );
};