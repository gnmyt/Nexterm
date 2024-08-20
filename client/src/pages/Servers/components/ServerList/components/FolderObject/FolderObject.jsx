import Icon from "@mdi/react";
import { mdiFolderOpenOutline, mdiFolderOutline } from "@mdi/js";
import "./styles.sass";
import { useContext, useEffect, useRef, useState } from "react";
import { patchRequest } from "@/common/utils/RequestUtil.js";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";

export const FolderObject = ({ id, name, nestedLevel, onClick, isOpen, renameState, setRenameStateId }) => {
    const inputRef = useRef();

    const {loadServers} = useContext(ServerContext);
    const [nameState, setNameState] = useState(name || "");

    const changeName = () => {
        setNameState(name => {
            patchRequest("folders/" + id + "/rename", { name }).then(() => {
                loadServers();
                setRenameStateId(null);
            });

            return name;
        });
    }

    useEffect(() => {
        if (renameState) {
            inputRef.current?.focus();
            inputRef.current?.select();

            const handleEnter = (e) => {
                if (e.key === "Enter") changeName();
            }

            document.addEventListener("keydown", handleEnter);
            return () => document.removeEventListener("keydown", handleEnter);
        }
    }, [renameState]);
    return (
        <div className="folder-object" style={{ paddingLeft: `${10 + (nestedLevel * 15)}px` }} data-id={id}
             onClick={renameState ? (e) => e.stopPropagation() : onClick}>
            <Icon path={isOpen ? mdiFolderOpenOutline : mdiFolderOutline} />
            {!renameState && <p>{nameState}</p>}
            {renameState && <input type="text" ref={inputRef} value={nameState} onBlur={changeName}
                                   onChange={(e) => setNameState(e.target.value)} />}
        </div>
    );
};