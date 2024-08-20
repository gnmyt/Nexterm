import Icon from "@mdi/react";
import { mdiFolderOpenOutline, mdiFolderOutline } from "@mdi/js";
import "./styles.sass";

export const FolderObject = ({ id, name, nestedLevel, onClick, isOpen }) => {
    return (
        <div className="folder-object" style={{ paddingLeft: `${10 + (nestedLevel * 15)}px` }} onClick={onClick}
             data-id={id}>
            <Icon path={isOpen ? mdiFolderOpenOutline : mdiFolderOutline} />
            <p>{name}</p>
        </div>
    );
};