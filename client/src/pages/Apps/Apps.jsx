import "./styles.sass";
import { AppNavigation } from "@/pages/Apps/components/AppNavigation";
import StoreHeader from "@/pages/Apps/components/StoreHeader";
import AppItem from "@/pages/Apps/components/AppItem";
import { useEffect, useState } from "react";
import { getRequest } from "@/common/utils/RequestUtil.js";
import { mdiPackageVariant } from "@mdi/js";
import Icon from "@mdi/react";
import AppInstaller from "@/pages/Apps/components/AppInstaller";

export const Apps = () => {

    const [selectedAppId, setSelectedAppId] = useState(null);
    const [apps, setApps] = useState([]);

    const reloadList = () => {
        getRequest("/apps").then((response) => {
            setApps(response);
        });
    };

    useEffect(() => {
        reloadList();
    }, []);

    return (
        <div className="apps-page">
            <AppNavigation />
            <div className="app-content">
                <StoreHeader />

                <div className="app-grid">
                    <div className="app-list">
                        {apps.map((app) => {
                            return <AppItem key={app.id} icon={app.icon} id={app.id} description={app.description}
                                            title={app.name} version={app.version} onClick={() => setSelectedAppId(app.id)} />;
                        })}
                    </div>

                    <div className="app-details">
                        {selectedAppId !== null && <AppInstaller app={apps.find((app) => app.id === selectedAppId)} />}
                        {selectedAppId === null && <div className="select-app">
                            <Icon path={mdiPackageVariant} />
                            <h3>Select app to continue</h3>
                        </div>}
                    </div>
                </div>
            </div>


        </div>
    );
};