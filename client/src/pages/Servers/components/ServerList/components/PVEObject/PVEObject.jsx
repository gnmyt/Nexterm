import "./styles.sass";
import ProxmoxIcon from "./assets/proxmox.png";
import ServerObject from "@/pages/Servers/components/ServerList/components/ServerObject";
import { useState } from "react";
import { mdiChevronDown, mdiChevronRight, mdiConsoleLine, mdiLinux, mdiMonitor, mdiServerOutline } from "@mdi/js";
import { getFolderState, setFolderState } from "@/common/utils/folderState";
import Icon from "@mdi/react";

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

    const [isOpen, setIsOpen] = useState(() => getFolderState(`pve-${id}`, true));

    const togglePVE = () => {
        const newState = !isOpen;
        setIsOpen(newState);
        setFolderState(`pve-${id}`, newState);
    };

    return (
        <>
            <div className={"pve-object" + (online ? "" : " pve-offline")} style={{ paddingLeft: `${15 + (nestedLevel * 15)}px` }} data-id={"pve-" + id}
                 onClick={togglePVE}>
                <img src={ProxmoxIcon} alt="Proxmox" />
                <p>{name}</p>
                <Icon path={isOpen ? mdiChevronDown : mdiChevronRight} className="pve-chevron" />
            </div>

            {isOpen && online && entries.map(entry => <ServerObject key={entry.id} id={"pve-" + id + "-" + entry.id}
                                                          name={entry.name}
                                                          nestedLevel={nestedLevel + 1}
                                                          icon={getIconByType(entry.type)}
                                                          status={entry.status}
                                                          connectToServer={() => connectToPVEServer(id, "pve-" + id + "-" + entry.id)}
                                                          isPVE />)}
        </>

    );
};