import Icon from "@mdi/react";
import { mdiBook, mdiPackageVariant, mdiScript, mdiPlus } from "@mdi/js";
import Button from "@/common/components/Button";
import { useContext } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import "./styles.sass";

export const StoreHeader = ({onSourceClick, isScriptsCategory, onCreateScript}) => {
    const { user } = useContext(UserContext);
    const isAdmin = user?.role === "admin";

    return (
        <div className="store-header">
            <div className="store-title">
                <Icon path={isScriptsCategory ? mdiScript : mdiPackageVariant} />
                <div className="descriptor">
                    <h1>{isScriptsCategory ? "Scripts" : "App Store"}</h1>
                    <p>{isScriptsCategory ? "Automate your server tasks with custom scripts." : "Your favorite apps, deployed with a single click."}</p>
                </div>
            </div>

            <div className="store-actions">
                {isAdmin && (
                    <Button text="Manage sources" icon={mdiBook} onClick={onSourceClick} type="secondary" />
                )}
                {isScriptsCategory && (
                    <Button text="Create Script" icon={mdiPlus} onClick={onCreateScript} />
                )}
            </div>
        </div>
    )
}