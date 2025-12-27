import { Outlet } from "react-router-dom";
import { UserProvider } from "@/common/contexts/UserContext.jsx";
import { StateStreamProvider } from "@/common/contexts/StateStreamContext.jsx";
import { ServerProvider } from "@/common/contexts/ServerContext.jsx";
import { IdentityProvider } from "@/common/contexts/IdentityContext.jsx";
import { ToastProvider } from "@/common/contexts/ToastContext.jsx";
import { Suspense } from "react";
import Loading from "@/common/components/Loading";
import { ErrorBoundary } from "@/common/components/ErrorBoundary";

export default () => {
    return (
        <ErrorBoundary>
            <ToastProvider>
                <UserProvider>
                    <StateStreamProvider>
                        <ServerProvider>
                            <IdentityProvider>
                                <Suspense fallback={<Loading />}>
                                    <Outlet />
                                </Suspense>
                            </IdentityProvider>
                        </ServerProvider>
                    </StateStreamProvider>
                </UserProvider>
            </ToastProvider>
        </ErrorBoundary>
    );
}
