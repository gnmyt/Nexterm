import Icon from "@mdi/react";
import { mdiBook, mdiPackageVariant, mdiScript, mdiPlus } from "@mdi/js";
import Button from "@/common/components/Button";
import SelectBox from "@/common/components/SelectBox";
import { useContext } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { useTranslation } from "react-i18next";
import "./styles.sass";

export const StoreHeader = ({
                                onSourceClick,
                                isScriptsCategory,
                                onCreateScript,
                                sources = [],
                                selectedSource,
                                setSelectedSource,
                            }) => {
    const { t } = useTranslation();
    const { user } = useContext(UserContext);
    const isAdmin = user?.role === "admin";

    const sourceOptions = sources.map(source => ({ label: source, value: source }));

    return (
        <div className="store-header">
            <div className="store-title">
                <Icon path={isScriptsCategory ? mdiScript : mdiPackageVariant} />
                <div className="descriptor">
                    <h1>{isScriptsCategory ? t("apps.store.scripts") : t("apps.store.appStore")}</h1>
                    <p>{isScriptsCategory ? t("apps.store.scriptsDescription") : t("apps.store.appStoreDescription")}</p>
                </div>
            </div>

            <div className="store-actions">
                {isScriptsCategory && sources.length > 0 && (
                    <div className="source-filter">
                        <label>{t("apps.store.source")}</label>
                        <SelectBox options={sourceOptions} selected={selectedSource} setSelected={setSelectedSource} />
                    </div>
                )}
                {isAdmin && (
                    <Button text={t("apps.store.manageSources")} icon={mdiBook} onClick={onSourceClick} type="secondary" />
                )}
                {isScriptsCategory && (
                    <Button text={t("apps.store.createScript")} icon={mdiPlus} onClick={onCreateScript} />
                )}
            </div>
        </div>
    );
};