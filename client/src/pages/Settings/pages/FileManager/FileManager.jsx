import "./styles.sass";
import { usePreferences } from "@/common/contexts/PreferencesContext.jsx";
import { useTranslation } from "react-i18next";
import { useContext, useEffect, useState } from "react";
import Icon from "@mdi/react";
import {
    mdiViewGrid, mdiViewList, mdiViewSequential, mdiCloudSync, mdiCloudOffOutline,
    mdiFolderOutline, mdiHarddisk, mdiCancel, mdiEyeOutline, mdiGestureTap, mdiMonitorShare, mdiAlertOutline,
} from "@mdi/js";
import Button from "@/common/components/Button";
import SelectBox from "@/common/components/SelectBox";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { SettingsHeading } from "@/common/components/SettingsDialog/SettingsHeading.jsx";
import { isTauri } from "@/common/utils/TauriUtil.js";
import { getSharedDrive, saveSharedDrive, describeSharedFolder } from "@/common/utils/HostFsProvider.js";

const Section = ({ icon, title, description, action, children }) => (
    <div className="file-manager-section settings-page-section">
        <div className="section-header">
            <SettingsHeading>
                <Icon path={icon} size={0.8} />
                {title}
            </SettingsHeading>
            {action}
        </div>
        <div className="section-inner">
            <p>{description}</p>
        </div>
        <div className="section-inner file-manager-fields">{children}</div>
    </div>
);

const Field = ({ label, children, wide = false }) => (
    <div className={`file-manager-field${wide ? " file-manager-field--wide" : ""}`}>
        <span className="file-manager-field__label">{label}</span>
        {children}
    </div>
);

const SharedDriveSection = () => {
    const { t } = useTranslation();
    const { sendToast } = useToast();
    const [setting, setSetting] = useState(getSharedDrive);
    const [resolvedFolder, setResolvedFolder] = useState(null);

    useEffect(() => {
        if (setting.mode !== "folder") return;
        setResolvedFolder(null);
        describeSharedFolder(setting.folder)
            .then(setResolvedFolder)
            .catch((error) => sendToast(t("common.error"), error?.message || t("settings.fileManager.sharedDrive.folderError")));
    }, [setting.mode, setting.folder]);

    const update = (next) => {
        saveSharedDrive(next);
        setSetting(next);
    };

    const chooseFolder = async () => {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const folder = await open({ directory: true, multiple: false, defaultPath: resolvedFolder || undefined });
        if (typeof folder === "string") update({ mode: "folder", folder });
    };

    const modeOptions = [
        { value: "folder", label: t("settings.fileManager.sharedDrive.mode.folder"), icon: mdiFolderOutline },
        { value: "disk", label: t("settings.fileManager.sharedDrive.mode.disk"), icon: mdiHarddisk },
        { value: "off", label: t("settings.fileManager.sharedDrive.mode.off"), icon: mdiCancel },
    ];

    return (
        <Section icon={mdiMonitorShare} title={t("settings.fileManager.sharedDrive.title")}
                 description={t("settings.fileManager.sharedDrive.description")}>
            <Field label={t("settings.fileManager.sharedDrive.mode.title")}>
                <SelectBox options={modeOptions} selected={setting.mode}
                           setSelected={(mode) => update({ ...setting, mode })} />
            </Field>

            {setting.mode === "folder" && (
                <Field label={t("settings.fileManager.sharedDrive.folder.title")} wide>
                    <div className="file-manager-folder">
                        <span className={`file-manager-folder__path${resolvedFolder ? "" : " file-manager-folder__path--placeholder"}`}>
                            {resolvedFolder || t("settings.fileManager.sharedDrive.folder.default")}
                        </span>
                        <Button type="secondary" text={t("settings.fileManager.sharedDrive.folder.choose")} onClick={chooseFolder} />
                        {setting.folder && (
                            <Button type="secondary" text={t("settings.fileManager.sharedDrive.folder.reset")}
                                    onClick={() => update({ mode: "folder", folder: null })} />
                        )}
                    </div>
                </Field>
            )}

            {setting.mode === "disk" && (
                <div className="file-manager-warning">
                    <Icon path={mdiAlertOutline} size={0.7} />
                    {t("settings.fileManager.sharedDrive.mode.diskWarning")}
                </div>
            )}
        </Section>
    );
};

export const FileManager = () => {
    const { t } = useTranslation();
    const { user } = useContext(UserContext);
    const { sendToast } = useToast();
    const {
        showThumbnails, setShowThumbnails,
        defaultViewMode, setDefaultViewMode,
        openOnSingleClick, setOpenOnSingleClick,
        showHiddenFiles, setShowHiddenFiles,
        confirmBeforeDelete, setConfirmBeforeDelete,
        dragDropAction, setDragDropAction,
        isGroupSynced, toggleGroupSync,
    } = usePreferences();

    const isFilesSynced = isGroupSynced("files");

    const handleSyncToggle = () => {
        if (!user) {
            sendToast(t("common.error"), t("settings.fileManager.syncLoginRequired"));
            return;
        }
        toggleGroupSync("files");
        sendToast(
            t("common.success"),
            isFilesSynced ? t("settings.fileManager.syncDisabled") : t("settings.fileManager.syncEnabled")
        );
    };

    const syncButton = (
        <Button icon={isFilesSynced ? mdiCloudSync : mdiCloudOffOutline} onClick={handleSyncToggle}
                type={isFilesSynced ? "primary" : undefined} />
    );

    const booleanOptions = (onLabel, offLabel) => [
        { value: "true", label: onLabel },
        { value: "false", label: offLabel },
    ];

    const viewOptions = [
        { value: "list", label: t("settings.fileManager.defaultView.list"), icon: mdiViewList },
        { value: "grid", label: t("settings.fileManager.defaultView.grid"), icon: mdiViewGrid },
        { value: "compact", label: t("settings.fileManager.defaultView.compact"), icon: mdiViewSequential },
    ];

    const dragDropOptions = [
        { value: "ask", label: t("settings.fileManager.dragDropAction.ask") },
        { value: "move", label: t("settings.fileManager.dragDropAction.move") },
        { value: "copy", label: t("settings.fileManager.dragDropAction.copy") },
    ];

    return (
        <div className="file-manager-settings">
            <Section icon={mdiEyeOutline} title={t("settings.fileManager.view.title")}
                     description={t("settings.fileManager.view.description")} action={syncButton}>
                <Field label={t("settings.fileManager.defaultView.label")}>
                    <SelectBox options={viewOptions} selected={defaultViewMode} setSelected={setDefaultViewMode} />
                </Field>
                <Field label={t("settings.fileManager.thumbnails.label")}>
                    <SelectBox options={booleanOptions(t("settings.fileManager.thumbnails.show"), t("settings.fileManager.thumbnails.hide"))}
                               selected={String(showThumbnails)} setSelected={(value) => setShowThumbnails(value === "true")} />
                </Field>
                <Field label={t("settings.fileManager.hiddenFiles.label")}>
                    <SelectBox options={booleanOptions(t("settings.fileManager.hiddenFiles.showShort"), t("settings.fileManager.hiddenFiles.hideShort"))}
                               selected={String(showHiddenFiles)} setSelected={(value) => setShowHiddenFiles(value === "true")} />
                </Field>
            </Section>

            <Section icon={mdiGestureTap} title={t("settings.fileManager.behavior.title")}
                     description={t("settings.fileManager.behavior.description")} action={syncButton}>
                <Field label={t("settings.fileManager.singleClickOpen.label")}>
                    <SelectBox options={booleanOptions(t("settings.fileManager.singleClickOpen.single"), t("settings.fileManager.singleClickOpen.double"))}
                               selected={String(openOnSingleClick)} setSelected={(value) => setOpenOnSingleClick(value === "true")} />
                </Field>
                <Field label={t("settings.fileManager.deleteConfirmation.label")}>
                    <SelectBox options={booleanOptions(t("settings.fileManager.deleteConfirmation.ask"), t("settings.fileManager.deleteConfirmation.immediately"))}
                               selected={String(confirmBeforeDelete)} setSelected={(value) => setConfirmBeforeDelete(value === "true")} />
                </Field>
                <Field label={t("settings.fileManager.dragDropAction.label")}>
                    <SelectBox options={dragDropOptions} selected={dragDropAction} setSelected={setDragDropAction} />
                </Field>
            </Section>

            {isTauri() && <SharedDriveSection />}
        </div>
    );
};
