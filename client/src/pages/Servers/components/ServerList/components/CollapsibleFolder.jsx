import FolderObject from "@/pages/Servers/components/ServerList/components/FolderObject";
import ServerEntries from "./ServerEntries.jsx";
import { useState } from "react";

const CollapsibleFolder = ({ name, entries, nestedLevel }) => {
    const [isOpen, setIsOpen] = useState(true);
    const toggleFolder = () => setIsOpen(!isOpen);

    return (
        <>
            <FolderObject name={name} nestedLevel={nestedLevel} onClick={toggleFolder} />
            {isOpen && (
                <ServerEntries entries={entries} nestedLevel={nestedLevel + 1} />
            )}
        </>
    );
};

export default CollapsibleFolder;