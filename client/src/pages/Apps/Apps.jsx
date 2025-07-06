import "./styles.sass";
import { AppNavigation } from "@/pages/Apps/components/AppNavigation";
import StoreHeader from "@/pages/Apps/components/StoreHeader";
import AppItem from "@/pages/Apps/components/AppItem";
import ScriptItem from "@/pages/Apps/components/ScriptItem";
import { useEffect, useState } from "react";
import { getRequest } from "@/common/utils/RequestUtil.js";
import { mdiPackageVariant, mdiSignCaution, mdiScript } from "@mdi/js";
import Icon from "@mdi/react";
import AppInstaller from "@/pages/Apps/components/AppInstaller";
import ScriptExecutor from "@/pages/Apps/components/ScriptExecutor";
import { useLocation, useNavigate } from "react-router-dom";
import DeployServerDialog from "@/pages/Apps/components/DeployServerDialog";
import SourceDialog from "@/pages/Apps/components/SourceDialog";
import ScriptDialog from "@/pages/Apps/components/ScriptDialog";

export const Apps = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
    const [scriptDialogOpen, setScriptDialogOpen] = useState(false);
    const [editingScript, setEditingScript] = useState(null);
    const [viewingScript, setViewingScript] = useState(null);

    const [serverDialogOpen, setServerDialogOpen] = useState(false);
    const [deployAppId, setDeployAppId] = useState(null);
    const [runScriptId, setRunScriptId] = useState(null);
    const [serverId, setServerId] = useState(null);

    const [installing, setInstalling] = useState(false);
    const [running, setRunning] = useState(false);
    const [selectedApp, setSelectedApp] = useState(null);
    const [selectedScript, setSelectedScript] = useState(null);
    const [apps, setApps] = useState([]);
    const [scripts, setScripts] = useState([]);

    const [search, setSearch] = useState("");

    const getCategory = () => {
        const endPath = location.pathname.split("/").pop();
        if (endPath === "apps") return null;

        return endPath;
    };

    const isScriptsCategory = () => getCategory() === "scripts";

    const updateSelectedApp = (id) => {
        setSelectedApp(apps.find((app) => app.id === id));
        setSelectedScript(null);
    };

    const updateSelectedScript = (id) => {
        setSelectedScript(scripts.find((script) => script.id === id));
        setSelectedApp(null);
    };

    const reloadList = () => {
        if (search) {
            if (isScriptsCategory()) {
                getRequest("/scripts?search=" + search).then((response) => {
                    setScripts(response);
                });
            } else {
                getRequest("/apps?search=" + search).then((response) => {
                    setApps(response);
                });
            }
            return;
        }

        const category = getCategory();

        if (category === "scripts") {
            getRequest("/scripts").then((response) => {
                setScripts(response);
            });
            return;
        } else if (category) {
            getRequest("/apps?category=" + category).then((response) => {
                setApps(response);
            });
            return;
        }

        getRequest("/apps").then((response) => {
            setApps(response);
        });
    };

    useEffect(() => {
        if (search !== "" && location.pathname !== "/apps/") {
            navigate("/apps/");
            return;
        }
        reloadList();
    }, [search, location]);

    const deployApp = (id) => {
        setDeployAppId(id);
        setServerDialogOpen(true);
    };

    const runScript = (id) => {
        setRunScriptId(id);
        setServerDialogOpen(true);
    };

    const viewScript = (id) => {
        const script = scripts.find((script) => script.id === id);
        setViewingScript(script);
        setScriptDialogOpen(true);
    };

    const editScript = (id) => {
        const script = scripts.find((script) => script.id === id);
        setEditingScript(script);
        setScriptDialogOpen(true);
    };

    const startDeployment = (serverId) => {
        setServerId(serverId);
        updateSelectedApp(deployAppId);
        setDeployAppId(null);
    };

    const startScriptExecution = (serverId) => {
        setServerId(serverId);
        updateSelectedScript(runScriptId);
        setRunScriptId(null);
    };

    const onScriptCreated = (script) => {
        setScripts(prevScripts => [...prevScripts, script]);
    };

    const onScriptUpdated = (updatedScript) => {
        setScripts(prevScripts => 
            prevScripts.map(script => 
                script.id === updatedScript.id ? updatedScript : script
            )
        );
    };

    return (
        <div className="apps-page">
            <AppNavigation search={search} setSearch={setSearch} />
            <SourceDialog open={sourceDialogOpen} onClose={() => setSourceDialogOpen(false)} refreshApps={reloadList} />
            <ScriptDialog
                open={scriptDialogOpen}
                onClose={() => {
                    setScriptDialogOpen(false);
                    setEditingScript(null);
                    setViewingScript(null);
                }}
                onScriptCreated={onScriptCreated}
                onScriptUpdated={onScriptUpdated}
                editingScript={editingScript}
                viewingScript={viewingScript}
            />
            <DeployServerDialog
                open={serverDialogOpen}
                onClose={() => setServerDialogOpen(false)}
                onDeploy={(serverId) => {
                    if (deployAppId) {
                        startDeployment(serverId);
                    } else if (runScriptId) {
                        startScriptExecution(serverId);
                    }
                }}
                app={apps.find((app) => app.id === deployAppId)}
                script={scripts.find((script) => script.id === runScriptId)}
            />
            <div className="app-content">
                <div className="store-header-wrapper">
                    <StoreHeader
                        onSourceClick={() => setSourceDialogOpen(true)} 
                        isScriptsCategory={isScriptsCategory()}
                        onCreateScript={() => setScriptDialogOpen(true)}
                    />
                </div>

                <div className="app-grid">
                    <div className={`app-list ${isScriptsCategory() ? "script-list" : ""}`}>
                        {isScriptsCategory() ? (
                            scripts.map((script) => {
                                return <ScriptItem
                                    key={script.id}
                                    icon={script.icon}
                                    title={script.name}
                                    description={script.description}
                                    running={running}
                                    isCustom={script.source === "custom"}
                                    onClick={() => runScript(script.id)}
                                    onView={() => viewScript(script.id)}
                                    onEdit={() => editScript(script.id)}
                                />;
                            })
                        ) : (
                            apps.map((app) => {
                                return <AppItem
                                    key={app.id}
                                    icon={app.icon}
                                    id={app.id}
                                    description={app.description}
                                    installing={installing}
                                    title={app.name}
                                    version={app.version}
                                    onClick={() => deployApp(app.id)}
                                />;
                            })
                        )}
                        {((isScriptsCategory() && scripts.length === 0) || (!isScriptsCategory() && apps.length === 0)) && (
                            <div className="no-apps">
                                <Icon path={isScriptsCategory() ? mdiScript : mdiSignCaution} />
                                <h2>{isScriptsCategory() ? "No scripts available" : "More apps coming soon"}</h2>
                            </div>
                        )}
                    </div>

                    <div className="app-details">
                        {selectedApp !== null &&
                            <AppInstaller serverId={serverId} app={selectedApp} setInstalling={setInstalling} />}
                        {selectedScript !== null &&
                            <ScriptExecutor serverId={serverId} script={selectedScript} setRunning={setRunning} />}
                        {selectedApp === null && selectedScript === null && (
                            <div className="select-app">
                                <Icon path={isScriptsCategory() ? mdiScript : mdiPackageVariant} />
                                <h3>Select {isScriptsCategory() ? "script" : "app"} to continue</h3>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};