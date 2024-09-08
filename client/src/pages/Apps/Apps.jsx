import "./styles.sass";
import { AppNavigation } from "@/pages/Apps/components/AppNavigation";
import StoreHeader from "@/pages/Apps/components/StoreHeader";
import AppItem from "@/pages/Apps/components/AppItem";
import { useEffect, useState } from "react";
import { getRequest } from "@/common/utils/RequestUtil.js";
import { mdiPackageVariant, mdiSignCaution } from "@mdi/js";
import Icon from "@mdi/react";
import AppInstaller from "@/pages/Apps/components/AppInstaller";
import { useLocation, useNavigate } from "react-router-dom";

export const Apps = () => {

    const location = useLocation();
    const navigate = useNavigate();

    const [installing, setInstalling] = useState(false);
    const [selectedApp, setSelectedApp] = useState(null);
    const [apps, setApps] = useState([]);

    const [search, setSearch] = useState("");

    const getCategory = () => {
        const endPath = location.pathname.split("/").pop();
        if (endPath === "apps") return null;

        return endPath;
    }

    const updateSelectedApp = (id) => {
        setSelectedApp(apps.find((app) => app.id === id));
    }

    const reloadList = () => {
        if (search) {
            getRequest("/apps?search=" + search).then((response) => {
                setApps(response);
            });
            return;
        }

        const category = getCategory();

        if (category) {
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

    return (
        <div className="apps-page">
            <AppNavigation search={search} setSearch={setSearch} />
            <div className="app-content">
                <StoreHeader />

                <div className="app-grid">
                    <div className="app-list">
                        {apps.map((app) => {
                            return <AppItem key={app.id} icon={app.icon} id={app.id} description={app.description} installing={installing}
                                            title={app.name} version={app.version} onClick={() => updateSelectedApp(app.id)} />;
                        })}
                        {apps.length === 0 && <div className="no-apps">
                            <Icon path={mdiSignCaution} />
                            <h2>More apps coming soon</h2>
                        </div>
                        }
                    </div>

                    <div className="app-details">
                        {selectedApp !== null && <AppInstaller serverId={1} app={selectedApp} setInstalling={setInstalling} />}
                        {selectedApp === null && <div className="select-app">
                            <Icon path={mdiPackageVariant} />
                            <h3>Select app to continue</h3>
                        </div>}
                    </div>
                </div>
            </div>


        </div>
    );
};