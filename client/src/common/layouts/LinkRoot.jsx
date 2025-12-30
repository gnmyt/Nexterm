import { Outlet } from "react-router-dom";
import { UserProvider } from "@/common/contexts/UserContext.jsx";
import { ToastProvider } from "@/common/contexts/ToastContext.jsx";
import { Suspense } from "react";
import Loading from "@/common/components/Loading";
import { ErrorBoundary } from "@/common/components/ErrorBoundary";
import TitleBar from "@/common/components/TitleBar";

export default () => {
    return (
        <ErrorBoundary>
            <ToastProvider>
                <UserProvider>
                    <div className="app-wrapper">
                        <TitleBar />
                        <Suspense fallback={<Loading />}>
                            <Outlet />
                        </Suspense>
                    </div>
                </UserProvider>
            </ToastProvider>
        </ErrorBoundary>
    );
};
