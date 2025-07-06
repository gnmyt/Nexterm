import { DialogProvider } from "@/common/components/Dialog";
import { useContext } from "react";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import ServerEntries from "@/pages/Servers/components/ServerList/components/ServerEntries.jsx";
import Icon from "@mdi/react";
import { mdiScript } from "@mdi/js";
import "./styles.sass";

export const DeployServerDialog = ({app, script, open, onClose, onDeploy}) => {

    const {servers} = useContext(ServerContext);

    const item = app || script;
    const isScript = !!script;

    const deployServer = (id) => {
        onClose();
        onDeploy(id);
    }

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="deploy-dialog">
                <div className="deploy-header">
                    {item?.icon ? (
                        <img src={item.icon} alt={item.name} />
                    ) : isScript ? (
                        <Icon path={mdiScript} />
                    ) : null}
                    <h2>{isScript ? "Run" : "Deploy"} {item?.name}</h2>
                </div>
                <div className="deploy-entries">
                    {servers?.length > 0 && <ServerEntries entries={servers} nestedLevel={0} sshOnly connectToServer={deployServer} />}
                    {servers?.length === 0 && <p>No SSH servers available</p>}
                </div>
            </div>
        </DialogProvider>
    )
}