import "./styles.sass";
import Icon from "@mdi/react";
import { mdiChevronLeft, mdiChevronRight, mdiChevronUp, mdiFileUpload, mdiFolderPlus } from "@mdi/js";
import { Fragment, useState, useRef, useEffect } from "react";

export const ActionBar = ({
                              path,
                              updatePath,
                              createFolder,
                              uploadFile,
                              goBack,
                              goForward,
                              historyIndex,
                              historyLength,
                          }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editPath, setEditPath] = useState(path);
    const inputRef = useRef(null);

    useEffect(() => {
        setEditPath(path);
    }, [path]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.setSelectionRange(inputRef.current.value.length, inputRef.current.value.length);
        }
    }, [isEditing]);

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

    const handleAddressBarClick = () => setIsEditing(true);

    const handleInputKeyDown = (e) => {
        if (e.key === "Enter") {
            handlePathSubmit();
        } else if (e.key === "Escape") {
            handlePathCancel();
        }
    };

    const handlePathSubmit = () => {
        let newPath = editPath.trim();

        if (!newPath.startsWith("/")) newPath = "/" + newPath;

        if (newPath !== "/" && newPath.endsWith("/")) newPath = newPath.slice(0, -1);

        updatePath(newPath);
        setIsEditing(false);
    };

    const handlePathCancel = () => {
        setEditPath(path);
        setIsEditing(false);
    };

    const handleInputBlur = () => handlePathSubmit();

    return (
        <div className="action-bar">
            <Icon path={mdiChevronLeft} onClick={goBack} className={historyIndex === 0 ? " nav-disabled" : ""} />
            <Icon path={mdiChevronRight} onClick={goForward}
                  className={historyIndex === historyLength - 1 ? " nav-disabled" : ""} />
            <Icon path={mdiChevronUp} onClick={goUp} className={path === "/" ? " nav-disabled" : ""} />

            <div className="address-bar" onClick={handleAddressBarClick}>
                {isEditing ?
                    <input ref={inputRef} type="text" value={editPath} onChange={(e) => setEditPath(e.target.value)}
                           onKeyDown={handleInputKeyDown} onBlur={handleInputBlur} className="path-input" /> :
                    <>
                        <div className="path-part-divider" onClick={(e) => {
                            e.stopPropagation();
                            updatePath("/");
                        }}>/
                        </div>
                        {getPathArray().map((part, index) => (
                            <Fragment key={index}>
                                <div className="path-part" onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(index);
                                }}>{part}</div>
                                <div className="path-part-divider">/</div>
                            </Fragment>
                        ))}
                    </>
                }
            </div>

            <div className="file-actions">
                <Icon path={mdiFileUpload} onClick={uploadFile} />
                <Icon path={mdiFolderPlus} onClick={createFolder} />
            </div>
        </div>
    );
};