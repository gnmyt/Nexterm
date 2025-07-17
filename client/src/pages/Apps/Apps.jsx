import "./styles.sass";
import { AppNavigation } from "@/pages/Apps/components/AppNavigation";
import StoreHeader from "@/pages/Apps/components/StoreHeader";
import AppItem from "@/pages/Apps/components/AppItem";
import ScriptItem from "@/pages/Apps/components/ScriptItem";
import { useEffect, useState, useRef } from "react";
import { getRequest, deleteRequest } from "@/common/utils/RequestUtil.js";
import { mdiPackageVariant, mdiSignCaution, mdiScript } from "@mdi/js";
import Icon from "@mdi/react";
import AppInstaller from "@/pages/Apps/components/AppInstaller";
import ScriptExecutor from "@/pages/Apps/components/ScriptExecutor";
import { useLocation, useNavigate } from "react-router-dom";
import DeployServerDialog from "@/pages/Apps/components/DeployServerDialog";
import SourceDialog from "@/pages/Apps/components/SourceDialog";
import ScriptDialog from "@/pages/Apps/components/ScriptDialog";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { useTranslation } from "react-i18next";

export const Apps = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { sendToast } = useToast();
    const { t } = useTranslation();

    const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
    const [scriptDialogOpen, setScriptDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [scriptToDelete, setScriptToDelete] = useState(null);
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

    const scriptExecutorRef = useRef(null);
    const [apps, setApps] = useState([]);
    const [scripts, setScripts] = useState([]);
    const [allScripts, setAllScripts] = useState([]);
    const [sources, setSources] = useState([]);
    const [selectedSource, setSelectedSource] = useState("All");

    const [search, setSearch] = useState("");

    const [showEasterEgg, setShowEasterEgg] = useState(false);
    const [konamiSequence, setKonamiSequence] = useState([]);

    const getCategory = () => {
        const endPath = location.pathname.split("/").pop();
        if (endPath === "apps") return null;

        return endPath;
    };

    const isScriptsCategory = () => getCategory() === "scripts";

    const getUniqueSources = (scriptsData) => {
        const uniqueSources = [...new Set(scriptsData.map(script => script.source))];
        const sourceOptions = ["All", ...uniqueSources.filter(source => source !== "custom"), "Custom"];
        setSources(sourceOptions);
    };

    const filterScriptsBySource = (scriptsData) => {
        let filtered = scriptsData;

        if (!showEasterEgg) {
            filtered = filtered.filter(script => !(script.source === "official" && script.id === "official/000easteregg"));
        }

        if (selectedSource === "All") {
            return filtered;
        } else if (selectedSource === "Custom") {
            return filtered.filter(script => script.source === "custom");
        } else {
            return filtered.filter(script => script.source === selectedSource);
        }
    };

    const konamiCode = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "KeyB", "KeyA"]; // ↑ ↑ ↓ ↓ ← → ← → B A

    const handleKonamiCode = (event) => {
        const newSequence = [...konamiSequence, event.code].slice(-konamiCode.length);
        setKonamiSequence(newSequence);

        if (newSequence.length === konamiCode.length &&
            newSequence.every((key, index) => key === konamiCode[index])) {
            setShowEasterEgg(true);
            setKonamiSequence([]);
        }
    };

    const applySourceFilter = () => {
        const filteredScripts = filterScriptsBySource(allScripts);
        setScripts(filteredScripts);
    };

    useEffect(() => {
        if (isScriptsCategory()) applySourceFilter();
    }, [showEasterEgg]);

    const updateSelectedApp = (id) => {
        setSelectedApp(apps.find((app) => app.id === id));
        setSelectedScript(null);
    };

    const updateSelectedScript = (id) => {
        setSelectedScript(allScripts.find((script) => script.id === id) || scripts.find((script) => script.id === id));
        setSelectedApp(null);
    };

    const reloadList = () => {
        if (search) {
            if (isScriptsCategory()) {
                getRequest("/scripts?search=" + search).then((response) => {
                    setAllScripts(response);
                    getUniqueSources(response);
                    const filteredScripts = filterScriptsBySource(response);
                    setScripts(filteredScripts);
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
                setAllScripts(response);
                getUniqueSources(response);
                const filteredScripts = filterScriptsBySource(response);
                setScripts(filteredScripts);
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

        if (!isScriptsCategory() && selectedSource !== "All") setSelectedSource("All");

        reloadList();
    }, [search, location]);

    useEffect(() => {
        if (isScriptsCategory()) applySourceFilter();
    }, [selectedSource, showEasterEgg]);

    useEffect(() => {
        document.addEventListener("keydown", handleKonamiCode);
        return () => {
            document.removeEventListener("keydown", handleKonamiCode);
        };
    }, [konamiSequence]);

    const deployApp = (id) => {
        setDeployAppId(id);
        setServerDialogOpen(true);
    };

    const runScript = (id) => {
        setRunScriptId(id);
        setServerDialogOpen(true);
    };

    const viewScript = (id) => {
        const script = allScripts.find((script) => script.id === id) || scripts.find((script) => script.id === id);
        setViewingScript(script);
        setScriptDialogOpen(true);
    };

    const editScript = (id) => {
        const script = allScripts.find((script) => script.id === id) || scripts.find((script) => script.id === id);
        setEditingScript(script);
        setScriptDialogOpen(true);
    };

    const deleteScript = async (id) => {
        const script = allScripts.find((script) => script.id === id) || scripts.find((script) => script.id === id);
        if (!script || script.source !== "custom") {
            sendToast("Error", t("apps.messages.onlyCustomScriptsCanBeDeleted"));
            return;
        }

        setScriptToDelete(script);
        setDeleteDialogOpen(true);
    };

    const confirmDeleteScript = async () => {
        if (!scriptToDelete) return;

        try {
            await deleteRequest(`scripts/${encodeURIComponent(scriptToDelete.id)}`);
            sendToast("Success", t("apps.messages.scriptDeletedSuccessfully"));

            const updatedAllScripts = allScripts.filter(s => s.id !== scriptToDelete.id);
            setAllScripts(updatedAllScripts);
            getUniqueSources(updatedAllScripts);
            const filteredScripts = filterScriptsBySource(updatedAllScripts);
            setScripts(filteredScripts);

            if (selectedScript && selectedScript.id === scriptToDelete.id) {
                setSelectedScript(null);
            }
        } catch (error) {
            sendToast("Error", error.message || t("apps.messages.failedToDeleteScript"));
        } finally {
            setScriptToDelete(null);
        }
    };

    const startDeployment = (serverId) => {
        setServerId(serverId);
        updateSelectedApp(deployAppId);
        setDeployAppId(null);
    };

    const startScriptExecution = (serverId) => {
        setServerId(serverId);

        if (selectedScript?.id !== runScriptId) {
            updateSelectedScript(runScriptId);
        }

        setRunScriptId(null);
    };

    const onScriptCreated = (script) => {
        const updatedAllScripts = [...allScripts, script];
        setAllScripts(updatedAllScripts);
        getUniqueSources(updatedAllScripts);
        const filteredScripts = filterScriptsBySource(updatedAllScripts);
        setScripts(filteredScripts);
    };

    const onScriptUpdated = (updatedScript) => {
        const updatedAllScripts = allScripts.map(script =>
            script.id === updatedScript.id ? updatedScript : script,
        );
        setAllScripts(updatedAllScripts);
        getUniqueSources(updatedAllScripts);
        const filteredScripts = filterScriptsBySource(updatedAllScripts);
        setScripts(filteredScripts);
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
                script={allScripts.find((script) => script.id === runScriptId) || scripts.find((script) => script.id === runScriptId)}
            />
            <ActionConfirmDialog open={deleteDialogOpen} setOpen={setDeleteDialogOpen} onConfirm={confirmDeleteScript}
                                 text={scriptToDelete ? t("apps.messages.deleteScriptConfirmation", { name: scriptToDelete.name }) : ""} />
            <div className="app-content">
                <div className="store-header-wrapper">
                    <StoreHeader
                        onSourceClick={() => setSourceDialogOpen(true)}
                        isScriptsCategory={isScriptsCategory()}
                        onCreateScript={() => setScriptDialogOpen(true)}
                        sources={sources}
                        selectedSource={selectedSource}
                        setSelectedSource={setSelectedSource}
                    />
                </div>

                <div className="app-grid">
                    <div className={`app-list ${isScriptsCategory() ? "script-list" : ""}`}>
                        {isScriptsCategory() ? (
                            scripts.map((script) => {
                                const isEasterEgg = script.source === "official" && script.id === "official/000easteregg";
                                return <ScriptItem
                                    key={script.id}
                                    title={script.name}
                                    description={script.description}
                                    running={running}
                                    isCustom={script.source === "custom"}
                                    isEasterEgg={isEasterEgg}
                                    onClick={() => runScript(script.id)}
                                    onView={() => viewScript(script.id)}
                                    onEdit={() => editScript(script.id)}
                                    onDelete={() => deleteScript(script.id)}
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
                                <h2>{isScriptsCategory() ? t("apps.list.noScripts") : t("apps.list.noApps")}</h2>
                            </div>
                        )}
                    </div>

                    <div className="app-details">
                        {selectedApp !== null &&
                            <AppInstaller serverId={serverId} app={selectedApp} setInstalling={setInstalling} />}
                        {selectedScript !== null &&
                            <ScriptExecutor ref={scriptExecutorRef} serverId={serverId} script={selectedScript}
                                            setRunning={setRunning} />}
                        {selectedApp === null && selectedScript === null && (
                            <div className="select-app">
                                <Icon path={isScriptsCategory() ? mdiScript : mdiPackageVariant} />
                                <h3>{isScriptsCategory() ? t("apps.list.selectScript") : t("apps.list.selectApp")}</h3>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};