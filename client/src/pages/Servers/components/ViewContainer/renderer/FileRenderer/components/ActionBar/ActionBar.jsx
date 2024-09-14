import "./styles.sass";
import Icon from "@mdi/react";
import { mdiChevronLeft, mdiChevronRight, mdiChevronUp, mdiFileUpload, mdiFolderPlus } from "@mdi/js";
import { Fragment } from "react";

export const ActionBar = ({path, updatePath, createFolder, uploadFile}) => {

    const goUp = () => {
        const pathArray = path.split("/");
        pathArray.pop();

        if (pathArray.length === 1 && pathArray[0] === "") {
            pathArray.pop();
        }

        updatePath(pathArray.length === 0 ? "/" : pathArray.join("/"));
    }

    const navigate = (part) => {
        const pathArray = getPathArray();
        updatePath("/" + pathArray.slice(0, part + 1).join("/"));
    }

    const getPathArray = () => {
        return path.split("/").filter(part => part !== "");
    }

    return (
        <div className="action-bar">
            <Icon path={mdiChevronLeft} />
            <Icon path={mdiChevronRight} />
            <Icon path={mdiChevronUp} onClick={goUp} />

            <div className="address-bar">
                <div className="path-part-divider" onClick={() => updatePath("/")}>/</div>
                {getPathArray().map((part, index) => (
                    <Fragment key={index}>
                        <div className="path-part" onClick={() => navigate(index)}>
                            {part}
                        </div>
                        <div className="path-part-divider">/</div>
                    </Fragment>
                ))}
            </div>

            <div className="file-actions">
                <Icon path={mdiFileUpload} onClick={uploadFile} />
                <Icon path={mdiFolderPlus} onClick={createFolder} />
            </div>
        </div>
    )
}