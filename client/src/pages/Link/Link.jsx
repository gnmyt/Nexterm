import { useSearchParams } from "react-router-dom";
import { useContext } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { DeviceLinkContent } from "@/common/components/DeviceLinkDialog";
import Loading from "@/common/components/Loading";
import "@/common/components/DeviceLinkDialog/styles.sass";
import "./styles.sass";

export const Link = () => {
    const [searchParams] = useSearchParams();
    const { user } = useContext(UserContext);
    const code = searchParams.get("code") || "";

    if (!user) return <Loading />;

    return (
        <div className="link-page">
            <div className="link-page-card">
                <DeviceLinkContent prefillCode={code} isPage={true} />
            </div>
        </div>
    );
};