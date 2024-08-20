import { createContext, useEffect, useState } from "react";
import LoginDialog from "@/common/components/LoginDialog";
import { getRequest } from "@/common/utils/RequestUtil.js";

export const UserContext = createContext({});

export const UserProvider = ({ children }) => {

    const [sessionToken, setSessionToken] = useState(localStorage.getItem("sessionToken"));
    const [user, setUser] = useState(null);

    const updateSessionToken = (sessionToken) => {
        setSessionToken(sessionToken);
        localStorage.setItem("sessionToken", sessionToken);

        login();
    }

    const login = async () => {
        try {
            const userObj = await getRequest("accounts/me");
            setUser(userObj);
        } catch (error) {
            if (error.message === "Unauthorized") {
                setSessionToken(null);
                localStorage.removeItem("sessionToken");
            }
            return;
        }
    }

    useEffect(() => {
        if (sessionToken) {
            login();
        }
    }, []);

    return (
        <UserContext.Provider value={{updateSessionToken, user, sessionToken}}>
            <LoginDialog open={!sessionToken} />
            {children}
        </UserContext.Provider>
    );
}