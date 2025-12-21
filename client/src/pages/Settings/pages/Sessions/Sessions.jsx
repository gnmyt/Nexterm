import "./styles.sass";
import { useContext, useEffect, useState } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { deleteRequest, getRequest } from "@/common/utils/RequestUtil.js";
import { UAParser } from "ua-parser-js";
import Icon from "@mdi/react";
import { mdiCellphone, mdiMonitor, mdiTablet } from "@mdi/js";
import { useTranslation } from "react-i18next";
import Button from "@/common/components/Button";

export const Sessions = () => {
    const { t } = useTranslation();
    const [sessions, setSessions] = useState([]);
    const {logout: logoutMyself, login, user} = useContext(UserContext);

    const parser = new UAParser();

    const getIconFromDevice = (device) => {
        switch (device) {
            case "wearable":
            case "mobile":
                return mdiCellphone;
            case "tablet":
                return mdiTablet;
            case "console":
            case "smarttv":
            case "embedded":
            case undefined:
            default:
                return mdiMonitor;
        }
    };

    const loadSessions = () => {
        getRequest("sessions/list").then(response => {
            setSessions(response);
        });
    }

    const logout = (sessionId) => {
        deleteRequest(`sessions/${sessionId}`).then(() => {
            login();
            loadSessions();
        });
    }

    useEffect(() => {
        loadSessions();
    }, [user]);

    return (
        <div className="sessions-page">
            <div className="sessions-header">
                <h2>{t("settings.sessions.title")}</h2>
            </div>

            <div className="vertical-list">
                {sessions.map(session => (
                    <div className="item" key={session.id}>
                        <div className="left-section">
                            <div className={`icon ${session.current ? "success" : "primary"}`}>
                                <Icon path={getIconFromDevice(parser.setUA(session.userAgent).getDevice().type)} />
                            </div>
                            <div className="details">
                                <h3>
                                    {t("settings.sessions.browserOn", {
                                        browser: parser.setUA(session.userAgent).getBrowser().name,
                                        version: parser.setUA(session.userAgent).getBrowser().version,
                                        os: parser.setUA(session.userAgent).getOS().name,
                                        osVersion: parser.setUA(session.userAgent).getOS().version,
                                        interpolation: { escapeValue: false }
                                    })}
                                </h3>
                                <p>
                                    {session.current 
                                        ? t("settings.sessions.currentSession")
                                        : t("settings.sessions.lastActivity", { 
                                            date: new Date(session.lastActivity).toLocaleString(), 
                                            ip: session.ip, 
                                            interpolation: { escapeValue: false } 
                                        })
                                    }
                                </p>
                            </div>
                        </div>
                        <div className="right-section">
                            <Button 
                                text={session.current ? t("settings.sessions.logout") : t("settings.sessions.revoke")} 
                                type="danger" 
                                onClick={() => session.current ? logoutMyself() : logout(session.id)}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};