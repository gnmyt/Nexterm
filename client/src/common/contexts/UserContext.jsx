import { createContext, useEffect, useState } from "react";
import LoginDialog from "@/common/components/LoginDialog";
import ConnectorSetup from "@/common/components/ConnectorSetup";
import { getRequest, postRequest } from "@/common/utils/RequestUtil.js";
import { useLocation, useNavigate } from "react-router-dom";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { isTauri, getActiveServerUrl, setActiveServerUrl } from "@/common/utils/TauriUtil.js";
import {
    getServers, getActiveServerId,
    removeServer, updateServerToken, switchServer as switchServerUtil
} from "@/common/utils/ConnectorServers.js";

export const UserContext = createContext({});

export const UserProvider = ({ children }) => {
    const location = useLocation();
    const navigate = useNavigate();

    const isConnectorMode = isTauri();
    const hasActiveServer = !!getActiveServerUrl();

    const [sessionToken, setSessionToken] = useState(localStorage.getItem("overrideToken")
        || localStorage.getItem("sessionToken"));
    const [firstTimeSetup, setFirstTimeSetup] = useState(false);
    const [user, setUser] = useState(null);
    const [addingServer, setAddingServer] = useState(false);
    const {sendToast} = useToast();

    const updateSessionToken = (sessionToken) => {
        setSessionToken(sessionToken);
        localStorage.setItem("sessionToken", sessionToken);

        const activeId = getActiveServerId();
        if (activeId) updateServerToken(activeId, sessionToken);

        login();
    };

    const checkFirstTimeSetup = async () => {
        if (isConnectorMode && !hasActiveServer) return;

        try {
            const response = await getRequest("service/is-fts");
            setFirstTimeSetup(response);
        } catch (error) {
            console.error(error);
        }
    };

    const login = async () => {
        if (isConnectorMode && !hasActiveServer) return;
        
        try {
            const userObj = await getRequest("accounts/me");
            setUser(userObj);
        } catch (error) {
            if (error.message === "Unauthorized") {
                setSessionToken(null);
                localStorage.removeItem("sessionToken");
                checkFirstTimeSetup();
            }
        }
    };

    const logout = async () => {
        try {
            await postRequest("auth/logout", { token: sessionToken });
        } catch {}

        if (isConnectorMode) {
            const activeId = getActiveServerId();
            if (activeId) removeServer(activeId);

            const remaining = getServers();
            if (remaining.length > 0) {
                switchServerUtil(remaining[0].id);
                return;
            }

            setActiveServerUrl(null);
            localStorage.removeItem("nexterm_active_server");
        }

        localStorage.removeItem("sessionToken");
        localStorage.removeItem("overrideToken");
        window.location.reload();
    };

    const overrideToken = (token) => {
        localStorage.setItem("overrideToken", token);
        setSessionToken(token);
        login();
    };

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const tokenFromUrl = searchParams.get('token');
        const error = searchParams.get('error');
        
        if (tokenFromUrl) {
            updateSessionToken(tokenFromUrl);
            navigate('/servers', { replace: true });
        } else if (error) {
            sendToast("Error", error);
        }
    }, [location]);

    useEffect(() => {
        if (isConnectorMode && !hasActiveServer) return;

        sessionToken ? login() : checkFirstTimeSetup();
    }, [sessionToken]);

    return (
        <UserContext.Provider value={{ updateSessionToken, user, sessionToken, firstTimeSetup, login, logout, overrideToken, isConnectorMode, addingServer, setAddingServer }}>
            {isConnectorMode ? (
                <ConnectorSetup open={!sessionToken || addingServer} isAddMode={addingServer} onCancelAdd={() => setAddingServer(false)} />
            ) : (
                <LoginDialog open={!sessionToken} />
            )}
            {children}
        </UserContext.Provider>
    );
};