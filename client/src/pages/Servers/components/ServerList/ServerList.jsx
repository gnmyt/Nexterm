import "./styles.sass";
import ServerSearch from "./components/ServerSearch";
import { useContext, useState } from "react";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import ServerEntries from "./components/ServerEntries.jsx";
import Icon from "@mdi/react";
import { mdiServerNetworkOff } from "@mdi/js";

const filterEntries = (entries, searchTerm) => {
    return entries
        .map(entry => {
            if (entry.type === "folder") {
                const filteredEntries = filterEntries(entry.entries, searchTerm);
                if (filteredEntries.length > 0) {
                    return { ...entry, entries: filteredEntries };
                }
            } else if (entry.type === "server") {
                if (entry.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                    return entry;
                }
            }
            return null;
        })
        .filter(entry => entry !== null);
};

export const ServerList = () => {
    const { servers } = useContext(ServerContext);
    const [search, setSearch] = useState("");

    const filteredServers = search ? filterEntries(servers, search) : servers;

    return (
        <div className="server-list">
            <div className="server-list-inner">
                <ServerSearch search={search} setSearch={setSearch} />
                {servers && servers.length >= 1 && <div className="servers">
                    <ServerEntries entries={filteredServers} nestedLevel={0} />
                </div>}
                {servers && servers.length === 0 && <p className="no-servers">
                    <Icon path={mdiServerNetworkOff} />
                    <p>No servers created</p>
                </p>}
            </div>
        </div>
    );
};
