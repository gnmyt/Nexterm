import "./styles.sass";
import { useContext, useEffect, useState } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { deleteRequest, getRequest } from "@/common/utils/RequestUtil.js";
import UAParser from "ua-parser-js";
import Icon from "@mdi/react";
import { mdiCellphone, mdiMonitor, mdiTablet } from "@mdi/js";

export const Sessions = () => {

    const [sessions, setSessions] = useState([]);
    const {login, user} = useContext(UserContext);

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

            {sessions.map(session => (
                <div className="session" key={session.id}>
                    <div className="session-info">
                        <div className={"icon-container" + (session.current ? " icon-current" : "")}>
                            <Icon path={getIconFromDevice(parser.setUA(session.userAgent).getDevice().type)} />
                        </div>
                        <div className="session-details">
                            <h2>
                                {parser.setUA(session.userAgent).getBrowser().name} {parser.setUA(session.userAgent).getBrowser().version}
                                &nbsp;on {parser.setUA(session.userAgent).getOS().name} {parser.setUA(session.userAgent).getOS().version}
                            </h2>
                            {!session.current && <p>Last activity: {new Date(session.lastActivity).toLocaleString()} from {session.ip}</p>}
                            {session.current && <p>Current session</p>}
                        </div>
                    </div>
                    <div className="session-actions">
                        <button className="btn btn-danger" onClick={() => logout(session.id)}>{session.current ? "Logout" : "Revoke"}</button>
                    </div>
                </div>
            ))}

        </div>
    );
};