import "./styles.sass";
import { useContext, useEffect, useState } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { deleteRequest, getRequest } from "@/common/utils/RequestUtil.js";
import { UAParser } from "ua-parser-js";
import Icon from "@mdi/react";
import { mdiCellphone, mdiMonitor, mdiTablet, mdiApplication, mdiCellphoneLink } from "@mdi/js";
import { useTranslation } from "react-i18next";
import Button from "@/common/components/Button";

const parseNextermUserAgent = (ua) => {
    if (!ua) return null;
    const conn = ua.match(/^NextermConnector\/([\d.]+)\s*\(([^;]+);\s*([^)]+)\)/);
    if (conn) return { app: 'Nexterm Connector', version: conn[1], os: conn[2].trim(), osVersion: conn[3].trim(), icon: 'connector' };
    const mobile = ua.match(/^NextermMobile\/([\d.]+)\s*\(([^;]+);?\s*([^)]*)\)/);
    if (mobile) return { app: 'Nexterm Mobile', version: mobile[1], os: mobile[2].trim().replace(/^\w/, c => c.toUpperCase()), osVersion: mobile[3]?.trim() || '', icon: 'mobile' };
    return null;
};

export const Sessions = () => {
    const { t } = useTranslation();
    const [sessions, setSessions] = useState([]);
    const {logout: logoutMyself, login, user} = useContext(UserContext);

    const parser = new UAParser();

    const getIconFromDevice = (device, nextermApp) => {
        if (nextermApp === 'connector') return mdiApplication;
        if (nextermApp === 'mobile') return mdiCellphoneLink;
        if (device === 'wearable' || device === 'mobile') return mdiCellphone;
        if (device === 'tablet') return mdiTablet;
        return mdiMonitor;
    };

    const getSessionDisplay = (ua) => {
        const n = parseNextermUserAgent(ua);
        if (n) return { browser: n.app, version: n.version, os: n.os, osVersion: n.osVersion, icon: n.icon };
        const p = parser.setUA(ua);
        return { browser: p.getBrowser().name, version: p.getBrowser().version, os: p.getOS().name, osVersion: p.getOS().version, icon: null };
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
                {sessions.map(session => {
                    const sessionInfo = getSessionDisplay(session.userAgent);
                    return (
                    <div className="item" key={session.id}>
                        <div className="left-section">
                            <div className={`icon ${session.current ? "success" : "primary"}`}>
                                <Icon path={getIconFromDevice(parser.setUA(session.userAgent).getDevice().type, sessionInfo.icon)} />
                            </div>
                            <div className="details">
                                <h3>
                                    {t("settings.sessions.browserOn", {
                                        browser: sessionInfo.browser,
                                        version: sessionInfo.version,
                                        os: sessionInfo.os,
                                        osVersion: sessionInfo.osVersion,
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
                    );
                })}
            </div>
        </div>
    );
};