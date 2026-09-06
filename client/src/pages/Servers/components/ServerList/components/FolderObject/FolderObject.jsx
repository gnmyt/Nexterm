import Icon from "@mdi/react";
import { mdiFolderOpenOutline, mdiFolderOutline } from "@mdi/js";
import ProxmoxIcon from "../../assets/proxmox.png";
import "./styles.sass";
import { useContext, useEffect, useRef, useState } from "react";
import { patchRequest } from "@/common/utils/RequestUtil.js";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import { useDrag, useDrop } from "react-dnd";

export const FolderObject = ({ id, name, nestedLevel, position, onClick, isOpen, renameState, setRenameStateId, organizationId, folderType }) => {
    const inputRef = useRef();

    const { loadServers } = useContext(ServerContext);
    const [nameState, setNameState] = useState(name || "");
    const elementRef = useRef(null);
    const [dropZone, setDropZone] = useState(null);

    useEffect(() => {
        if (!renameState) {
            setNameState(name || "");
        }
    }, [name, renameState]);

    const isIntegrationNode = folderType === "integration-node";
    const isIntegrationManaged = isIntegrationNode || folderType === "integration-root";

    const [{ opacity }, dragRef] = useDrag({
        type: "folder",
        item: { type: "folder", id, position },
        canDrag: () => !isIntegrationNode,
        collect: monitor => ({
            opacity: monitor.isDragging() ? 0.5 : 1,
        }),
    });

    const acceptsDrop = (item) => !isIntegrationManaged && !item.isIntegrationEntry;

    const [{ isOver }, dropRef] = useDrop({
        accept: ["server", "folder"],
        hover: (item, monitor) => {
            if (item.type !== "folder" || item.id === id || !acceptsDrop(item) || !elementRef.current) return;
            const offset = monitor.getClientOffset();
            if (!offset) return;
            const rect = elementRef.current.getBoundingClientRect();
            const y = offset.y - rect.top;
            const zone = y < rect.height * 0.3 ? "before" : y > rect.height * 0.7 ? "after" : "nest";
            setDropZone(prev => prev === zone ? prev : zone);
        },
        drop: async (item) => {
            if (item.id === id || !acceptsDrop(item)) { setDropZone(null); return { id }; }
            const zone = dropZone;
            setDropZone(null);
            try {
                if (item.type === "server") {
                    await patchRequest(`entries/${item.id}/reposition`, {
                        targetId: null,
                        placement: 'after',
                        folderId: id,
                        organizationId: organizationId
                    });
                } else if (zone === "before" || zone === "after") {
                    await patchRequest(`folders/${item.id}/reposition`, {
                        targetId: id,
                        placement: zone,
                        organizationId: organizationId
                    });
                } else {
                    await patchRequest(`folders/${item.id}`, { parentId: id });
                }
                loadServers();
            } catch (error) {
                console.error("Failed to drop item", error.message);
            }

            return { id };
        },
        collect: (monitor) => ({
            isOver: monitor.isOver() && monitor.getItem() != null && acceptsDrop(monitor.getItem()),
        }),
    });

    const dropZoneClass = isOver
        ? (dropZone === "before" ? " folder-drop-before" : dropZone === "after" ? " folder-drop-after" : " folder-is-over")
        : "";

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
        <div className={"folder-object" + dropZoneClass} data-id={id}
             role="button" tabIndex={0}
             onKeyDown={(e) => { if (!renameState && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick?.(e); } }}
             ref={(node) => { elementRef.current = node; dragRef(dropRef(node)); }} onClick={renameState ? (e) => e.stopPropagation() : onClick}
             style={{ paddingLeft: `${10 + (nestedLevel * 15)}px`, opacity }}>
            {(folderType === 'integration-node' || folderType === 'integration-root') ? (
                <img src={ProxmoxIcon} alt="Proxmox" style={{ width: '1.5rem', height: '1.5rem' }} />
            ) : (
                <Icon path={isOpen ? mdiFolderOpenOutline : mdiFolderOutline} />
            )}
            {!renameState && <p className="truncate-text">{nameState}</p>}
            {renameState && <input type="text" ref={inputRef} value={nameState} onBlur={changeName}
                                   onChange={(e) => setNameState(e.target.value)} />}
        </div>
    );
};