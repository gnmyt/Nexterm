import { createContext, useContext, useEffect, useState } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { getRequest } from "@/common/utils/RequestUtil.js";

export const IdentityContext = createContext({});

export const IdentityProvider = ({ children }) => {

    const [identities, setIdentities] = useState(null);
    const {user, sessionToken} = useContext(UserContext);

    const loadIdentities = async () => {
        try {
            getRequest("/identities/list").then((response) => {
                setIdentities(response);
            });
        } catch (error) {
            console.error("Failed to load identities", error.message);
        }
    }

    useEffect(() => {
        if (user) {
            loadIdentities();

            const interval = setInterval(() => {
                loadIdentities();
            }, 5000);

            return () => clearInterval(interval);
        } else if (!sessionToken) {
            setIdentities([]);
        }
    }, [user]);

    return (
        <IdentityContext.Provider value={{identities, loadIdentities}}>
            {children}
        </IdentityContext.Provider>
    )
}