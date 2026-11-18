import Icon from "@mdi/react";
import { mdiServerNetwork } from "@mdi/js";
import { getIconPath } from "@/common/utils/iconUtils.js";

export const ServerIdentity = ({ server, large = false }) => {
    const Heading = large ? "h2" : "h3";

    return (
        <>
            <div className={`mon-server-icon${large ? " mon-server-icon--large" : ""}`}>
                <Icon path={server.type === "proxmox" ? mdiServerNetwork : getIconPath(server.icon)} />
            </div>
            <div className="mon-server-title">
                <Heading>{server.name}</Heading>
                <p>{server.ip}{server.port ? `:${server.port}` : ""}</p>
            </div>
        </>
    );
};
