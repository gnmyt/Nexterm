import "./styles.sass";
import Icon from "@mdi/react";
import { mdiChevronLeft, mdiChevronRight, mdiChevronUp, mdiFileUpload, mdiFolderPlus } from "@mdi/js";
import { Fragment } from "react";

export const ActionBar = ({ path, updatePath, createFolder, uploadFile, goBack, goForward, historyIndex, historyLength }) => {

    const goUp = () => {
        const pathArray = path.split("/");
        pathArray.pop();

        if (pathArray.length === 1 && pathArray[0] === "") {
            pathArray.pop();
        }

        updatePath(pathArray.length === 0 ? "/" : pathArray.join("/"));
    };

    const navigate = (part) => {
        const pathArray = getPathArray();
        updatePath("/" + pathArray.slice(0, part + 1).join("/"));
    };

    const getPathArray = () => {
        return path.split("/").filter(part => part !== "");
    };

    return (
        <div className="action-bar">
            <Icon path={mdiChevronLeft} onClick={goBack} className={historyIndex === 0 ? " nav-disabled" : ""} />
            <Icon path={mdiChevronRight} onClick={goForward} className={historyIndex === historyLength - 1 ? " nav-disabled" : ""} />
            <Icon path={mdiChevronUp} onClick={goUp} className={path === "/" ? " nav-disabled" : ""} />

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
    );
};