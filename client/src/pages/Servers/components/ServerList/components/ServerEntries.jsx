import ServerObject from "@/pages/Servers/components/ServerList/components/ServerObject";
import CollapsibleFolder from "./CollapsibleFolder.jsx";

const ServerEntries = ({ entries, nestedLevel }) => {
    return (
        <>
            {entries.map(entry => {
                if (entry.type === "folder") {
                    return (
                        <CollapsibleFolder
                            key={entry.id}
                            name={entry.name}
                            entries={entry.entries}
                            nestedLevel={nestedLevel}
                        />
                    );
                } else if (entry.type === "server") {
                    return (
                        <ServerObject
                            key={entry.id}
                            name={entry.name}
                            nestedLevel={nestedLevel}
                            icon={entry.icon}
                        />
                    );
                }
                return null;
            })}
        </>
    );
};

export default ServerEntries;