import ServerObject from "@/pages/Servers/components/ServerList/components/ServerObject";
import CollapsibleFolder from "./CollapsibleFolder.jsx";
import OrganizationFolder from "./OrganizationFolder";

const ServerEntries = ({ entries, nestedLevel, setRenameStateId, connectToServer, folderId, organizationId }) => {
    return (
        <>
            {entries.map(entry => {
                if (entry.type === "organization") {
                    return (
                        <OrganizationFolder
                            id={entry.id}
                            key={"org-"+entry.id}
                            name={entry.name}
                            entries={entry.entries}
                            nestedLevel={nestedLevel}
                            connectToServer={connectToServer}
                            setRenameStateId={setRenameStateId}
                        />
                    );
                } else if (entry.type === "folder") {
                    return (
                        <CollapsibleFolder
                            id={entry.id}
                            key={"f"+entry.id}
                            name={entry.name}
                            entries={entry.entries}
                            renameState={entry.renameState}
                            setRenameStateId={setRenameStateId}
                            nestedLevel={nestedLevel}
                            organizationId={organizationId}
                            folderType={entry.folderType}
                            connectToServer={connectToServer}
                        />
                    );
                } else if (entry.type === "server" || entry.type.startsWith("pve-")) {
                    return (
                        <ServerObject
                            id={entry.id}
                            key={"s"+entry.id}
                            position={entry.position}
                            folderId={folderId}
                            organizationId={organizationId}
                            name={entry.name}
                            type={entry.type}
                            nestedLevel={nestedLevel}
                            icon={entry.icon}
                            status={entry.status}
                            connectToServer={connectToServer}
                        />
                    );
                }
                return null;
            })}
        </>
    );
};

export default ServerEntries;