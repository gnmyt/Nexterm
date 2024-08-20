import Icon from "@mdi/react";
import { mdiFolderOutline } from "@mdi/js";
import "./styles.sass";

export const FolderObject = ({name, nestedLevel, onClick}) => {
    return (
        <div className="folder-object" style={{paddingLeft: `${10 + (nestedLevel * 15)}px`}} onClick={onClick}>
            <Icon path={mdiFolderOutline} />
            <p>{name}</p>
        </div>
    )
}