import { createContext, useEffect, useState } from "react";
import LoginDialog from "@/common/components/LoginDialog";
import { getRequest, postRequest } from "@/common/utils/RequestUtil.js";

export const UserContext = createContext({});

export const UserProvider = ({ children }) => {

    const [sessionToken, setSessionToken] = useState(localStorage.getItem("overrideToken")
        || localStorage.getItem("sessionToken"));
    const [firstTimeSetup, setFirstTimeSetup] = useState(false);
    const [user, setUser] = useState(null);

    const updateSessionToken = (sessionToken) => {
        setSessionToken(sessionToken);
        localStorage.setItem("sessionToken", sessionToken);

        login();
    };

    const checkFirstTimeSetup = async () => {
        try {
            const response = await getRequest("service/is-fts");
            setFirstTimeSetup(response);
        } catch (error) {
            console.error(error);
        }
    };

    const login = async () => {
        try {
            const userObj = await getRequest("accounts/me");
            setUser(userObj);
        } catch (error) {
            if (error.message === "Unauthorized") {
                setSessionToken(null);
                localStorage.removeItem("sessionToken");
            }
        }
    };

    const logout = async () => {
        await postRequest("auth/logout", { token: sessionToken });

        if (localStorage.getItem("overrideToken")) {
            localStorage.removeItem("overrideToken");
            setSessionToken(localStorage.getItem("sessionToken"));
        }

        login();
    };

    const overrideToken = (token) => {
        localStorage.setItem("overrideToken", token);
        setSessionToken(token);
        login();
    };

    useEffect(() => {
        sessionToken ? login() : checkFirstTimeSetup();
    }, []);

    return (
        <UserContext.Provider value={{ updateSessionToken, user, sessionToken, firstTimeSetup, login, logout, overrideToken }}>
            <LoginDialog open={!sessionToken} />
            {children}
        </UserContext.Provider>
    );
};