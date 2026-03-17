import { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { StateStreamContext, STATE_TYPES } from "@/common/contexts/StateStreamContext.jsx";
import { getRequest, postRequest } from "@/common/utils/RequestUtil.js";

export const IdentityContext = createContext({});

export const IdentityProvider = ({ children }) => {
    const [identities, setIdentities] = useState(null);
    const { user, sessionToken } = useContext(UserContext);
    const { registerHandler } = useContext(StateStreamContext);

    useEffect(() => {
        if (user) return registerHandler(STATE_TYPES.IDENTITIES, setIdentities);
    }, [user, registerHandler]);

    const loadIdentities = useCallback(async () => {
        try {
            setIdentities(await getRequest("/identities/list"));
        } catch {}
    }, []);

    const personalIdentities = useMemo(() => identities?.filter(i => i.scope === 'personal') || [], [identities]);
    const organizationIdentities = useMemo(() => identities?.filter(i => i.scope === 'organization') || [], [identities]);
    const getOrganizationIdentities = (orgId) => organizationIdentities.filter(i => i.organizationId === orgId);
    const getIdentitiesForContext = (orgId = null) => orgId ? [...getOrganizationIdentities(orgId), ...personalIdentities] : personalIdentities;

    const moveIdentityToOrganization = async (identityId, organizationId) => {
        try {
            const result = await postRequest(`/identities/${identityId}/move`, { organizationId });
            return result.identity ? { success: true, identity: result.identity } : { success: false, error: result.message };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    useEffect(() => { if (!sessionToken) setIdentities([]); }, [sessionToken]);

    return (
        <IdentityContext.Provider value={{ identities, personalIdentities, organizationIdentities, loadIdentities, getOrganizationIdentities, getIdentitiesForContext, moveIdentityToOrganization }}>
            {children}
        </IdentityContext.Provider>
    );
};