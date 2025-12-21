import { createContext, useContext, useEffect, useState, useMemo } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { getRequest, postRequest } from "@/common/utils/RequestUtil.js";

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

    const personalIdentities = useMemo(() => {
        return identities?.filter(i => i.scope === 'personal') || [];
    }, [identities]);

    const organizationIdentities = useMemo(() => {
        return identities?.filter(i => i.scope === 'organization') || [];
    }, [identities]);

    const getOrganizationIdentities = (organizationId) => {
        return organizationIdentities.filter(i => i.organizationId === organizationId);
    };

    const getIdentitiesForContext = (organizationId = null) => {
        if (!organizationId) {
            return personalIdentities;
        }
        return [
            ...getOrganizationIdentities(organizationId),
            ...personalIdentities,
        ];
    };

    const moveIdentityToOrganization = async (identityId, organizationId) => {
        try {
            const result = await postRequest(`/identities/${identityId}/move`, { organizationId });
            if (result.identity) {
                await loadIdentities();
                return { success: true, identity: result.identity };
            }
            return { success: false, error: result.message };
        } catch (error) {
            console.error("Failed to move identity", error.message);
            return { success: false, error: error.message };
        }
    };

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
        <IdentityContext.Provider value={{
            identities,
            personalIdentities,
            organizationIdentities,
            loadIdentities,
            getOrganizationIdentities,
            getIdentitiesForContext,
            moveIdentityToOrganization,
        }}>
            {children}
        </IdentityContext.Provider>
    )
}