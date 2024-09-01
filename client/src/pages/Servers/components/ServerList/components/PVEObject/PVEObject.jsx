import "./styles.sass";
import ProxmoxIcon from "./assets/proxmox.png";
import ServerObject from "@/pages/Servers/components/ServerList/components/ServerObject";
import { useState } from "react";
import { mdiConsoleLine, mdiLinux, mdiMonitor, mdiServerOutline } from "@mdi/js";

export const getIconByType = (type) => {
    switch (type) {
        case "pve-shell":
            return mdiConsoleLine;
        case "pve-lxc":
            return mdiLinux;
        case "pve-vm":
            return mdiMonitor;
        default:
            return mdiServerOutline;
    }
};


export const PVEObject = ({ nestedLevel, name, id, online, entries, connectToPVEServer }) => {

    const [isOpen, setIsOpen] = useState(true);

    return (
        <>
            <div className={"pve-object" + (online ? "" : " pve-offline")} style={{ paddingLeft: `${10 + (nestedLevel * 15)}px` }} data-id={"pve-" + id}
                 onClick={() => setIsOpen(!isOpen)}>
                <img src={ProxmoxIcon} alt="Proxmox" />
                <p>{name}</p>
            </div>

            {isOpen && online && entries.map(entry => <ServerObject key={entry.id} id={"pve-" + id + "-" + entry.id}
                                                          name={entry.name}
                                                          nestedLevel={nestedLevel + 1}
                                                          icon={getIconByType(entry.type)}
                                                          status={entry.status}
                                                          connectToServer={(containerId) => connectToPVEServer(id, containerId)}
                                                          isPVE />)}
        </>

    );
};