import Icon from "@mdi/react";
import { mdiBook, mdiPackageVariant, mdiScript, mdiPlus } from "@mdi/js";
import Button from "@/common/components/Button";
import SelectBox from "@/common/components/SelectBox";
import { useContext } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import "./styles.sass";

export const StoreHeader = ({
                                onSourceClick,
                                isScriptsCategory,
                                onCreateScript,
                                sources = [],
                                selectedSource,
                                setSelectedSource,
                            }) => {
    const { user } = useContext(UserContext);
    const isAdmin = user?.role === "admin";

    const sourceOptions = sources.map(source => ({ label: source, value: source }));

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
                {isScriptsCategory && sources.length > 0 && (
                    <div className="source-filter">
                        <label>Source:</label>
                        <SelectBox options={sourceOptions} selected={selectedSource} setSelected={setSelectedSource} />
                    </div>
                )}
                {isAdmin && (
                    <Button text="Manage sources" icon={mdiBook} onClick={onSourceClick} type="secondary" />
                )}
                {isScriptsCategory && (
                    <Button text="Create Script" icon={mdiPlus} onClick={onCreateScript} />
                )}
            </div>
        </div>
    );
};