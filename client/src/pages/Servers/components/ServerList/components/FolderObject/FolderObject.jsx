import Icon from "@mdi/react";
import { mdiFolderOpenOutline, mdiFolderOutline } from "@mdi/js";
import "./styles.sass";
import { useContext, useEffect, useRef, useState } from "react";
import { patchRequest } from "@/common/utils/RequestUtil.js";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import { useDrag, useDrop } from "react-dnd";

export const FolderObject = ({ id, name, nestedLevel, position, onClick, isOpen, renameState, setRenameStateId }) => {
    const inputRef = useRef();

    const { loadServers } = useContext(ServerContext);
    const [nameState, setNameState] = useState(name || "");

    const [{ opacity }, dragRef] = useDrag({
        item: { type: "folder", id, position },
        type: "folder",
        collect: monitor => ({
            opacity: monitor.isDragging() ? 0.5 : 1,
        }),
    });

    const [{ isOver }, dropRef] = useDrop({
        accept: ["server", "folder"],
        drop: async (item) => {
            if (item.id === id) return;
            try {
                if (item.type === "server") {
                    await patchRequest("entries/" + item.id, { folderId: id });
                    loadServers();
                    return { id };
                }

                await patchRequest(`folders/${item.id}`, { parentId: item.id !== id ? id : undefined });
            } catch (error) {
                console.error("Failed to drop item", error.message);
            }

            loadServers();

            return { id };
        },
        collect: (monitor) => ({
            isOver: monitor.isOver(),
        }),
    });

    const changeName = () => {
        setNameState(name => {
            patchRequest("folders/" + id, { name }).then(() => {
                loadServers();
                setRenameStateId(null);
            });

            return name;
        });
    };

    useEffect(() => {
        if (renameState) {
            inputRef.current?.focus();
            inputRef.current?.select();

            const handleEnter = (e) => {
                if (e.key === "Enter") changeName();
            };

            document.addEventListener("keydown", handleEnter);
            return () => document.removeEventListener("keydown", handleEnter);
        }
    }, [renameState]);
    return (
        <div className={"folder-object" + (isOver ? " folder-is-over" : "")} data-id={id}
             ref={(node) => dragRef(dropRef(node))} onClick={renameState ? (e) => e.stopPropagation() : onClick}
             style={{ paddingLeft: `${10 + (nestedLevel * 15)}px`, opacity }}>
            <Icon path={isOpen ? mdiFolderOpenOutline : mdiFolderOutline} />
            {!renameState && <p className="truncate-text">{nameState}</p>}
            {renameState && <input type="text" ref={inputRef} value={nameState} onBlur={changeName}
                                   onChange={(e) => setNameState(e.target.value)} />}
        </div>
    );
};