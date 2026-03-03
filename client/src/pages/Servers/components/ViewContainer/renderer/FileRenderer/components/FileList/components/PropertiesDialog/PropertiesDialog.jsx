import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiFile, mdiFolder, mdiLoading } from "@mdi/js";
import { DialogProvider } from "@/common/components/Dialog";
import Button from "@/common/components/Button";
import TabSwitcher from "@/common/components/TabSwitcher";
import { parsePermissions, permissionsToMode, formatOctal } from "../../utils/fileUtils";
import { GeneralTab } from "./tabs/GeneralTab.jsx";
import { PermissionsTab } from "./tabs/PermissionsTab.jsx";
import { ChecksumTab } from "./tabs/ChecksumTab.jsx";
import "./styles.sass";

export const PropertiesDialog = ({ open, onClose, item, path, sendOperation, OPERATIONS, onRegisterHandler }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState("general");
    const [stats, setStats] = useState(null);
    const [loadingStats, setLoadingStats] = useState(false);
    const [checksums, setChecksums] = useState({});
    const [loadingChecksum, setLoadingChecksum] = useState({});
    const [folderSize, setFolderSize] = useState(null);
    const [loadingFolderSize, setLoadingFolderSize] = useState(false);
    const [copied, setCopied] = useState(null);
    const [permissions, setPermissions] = useState(null);
    const [octalInput, setOctalInput] = useState("");
    const [permissionsSaving, setPermissionsSaving] = useState(false);

    const isFolder = item?.type === "folder" || !item;
    const fullPath = item ? `${path}/${item.name}` : path;
    const displayName = item?.name || path.split("/").pop() || "/";

    useEffect(() => {
        if (!open) {
            setActiveTab("general");
            setStats(null);
            setChecksums({});
            setFolderSize(null);
            setPermissions(null);
            setOctalInput("");
            return;
        }
        setLoadingStats(true);
        sendOperation(OPERATIONS.STAT, { path: fullPath });
    }, [open, fullPath]);

    useEffect(() => {
        if (stats?.mode !== undefined) {
            const parsed = parsePermissions(stats.mode);
            setPermissions(parsed);
            setOctalInput(formatOctal(stats.mode));
        } else if (item?.mode !== undefined) {
            const parsed = parsePermissions(item.mode);
            setPermissions(parsed);
            setOctalInput(formatOctal(item.mode));
        }
    }, [stats, item]);

    const handleMessage = useCallback((data) => {
        if (data.operation === OPERATIONS.STAT) {
            setStats(data.payload);
            setLoadingStats(false);
        } else if (data.operation === OPERATIONS.CHECKSUM) {
            setChecksums(prev => ({ ...prev, [data.payload.algorithm]: data.payload.hash }));
            setLoadingChecksum(prev => ({ ...prev, [data.payload.algorithm]: false }));
        } else if (data.operation === OPERATIONS.FOLDER_SIZE) {
            setFolderSize(data.payload.size);
            setLoadingFolderSize(false);
        }
    }, [OPERATIONS]);

    useEffect(() => {
        if (open) {
            onRegisterHandler?.(handleMessage);
        }
        return () => { onRegisterHandler?.(null); };
    }, [open, handleMessage, onRegisterHandler]);

    const calculateChecksum = (algorithm) => {
        setLoadingChecksum(prev => ({ ...prev, [algorithm]: true }));
        sendOperation(OPERATIONS.CHECKSUM, { path: fullPath, algorithm });
    };

    const calculateFolderSize = () => {
        setLoadingFolderSize(true);
        sendOperation(OPERATIONS.FOLDER_SIZE, { path: fullPath });
    };

    const copyToClipboard = (text, key) => {
        navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 1500);
    };

    const handleSavePermissions = useCallback(() => {
        if (permissions) {
            const mode = permissionsToMode(permissions);
            setPermissionsSaving(true);
            sendOperation(OPERATIONS.CHMOD, { path: fullPath, mode });
            setTimeout(() => setPermissionsSaving(false), 500);
        }
    }, [permissions, sendOperation, OPERATIONS, fullPath]);

    const tabs = [
        { key: "general", label: t("servers.fileManager.properties.general") },
        { key: "permissions", label: t("servers.fileManager.properties.permissions") },
        ...(!isFolder ? [{ key: "checksum", label: t("servers.fileManager.properties.checksum") }] : []),
    ];

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="properties-dialog">
                <div className="dialog-header">
                    <div className="file-icon">
                        <Icon path={isFolder ? mdiFolder : mdiFile} />
                    </div>
                    <div className="file-info">
                        <h2 title={displayName}>{displayName}</h2>
                        <span className="file-type">{isFolder ? t("servers.fileManager.properties.folder") : t("servers.fileManager.properties.file")}</span>
                    </div>
                </div>

                <TabSwitcher tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} variant="pills" />

                {activeTab === "general" && (
                    <GeneralTab
                        fullPath={fullPath}
                        isFolder={isFolder}
                        stats={stats}
                        loadingStats={loadingStats}
                        folderSize={folderSize}
                        loadingFolderSize={loadingFolderSize}
                        item={item}
                        copied={copied}
                        onCopy={copyToClipboard}
                        onCalculateFolderSize={calculateFolderSize}
                    />
                )}

                {activeTab === "permissions" && (
                    <PermissionsTab
                        isFolder={isFolder}
                        permissions={permissions}
                        setPermissions={setPermissions}
                        octalInput={octalInput}
                        setOctalInput={setOctalInput}
                        copied={copied}
                        onCopy={copyToClipboard}
                    />
                )}

                {activeTab === "checksum" && !isFolder && (
                    <ChecksumTab
                        checksums={checksums}
                        loadingChecksum={loadingChecksum}
                        copied={copied}
                        onCopy={copyToClipboard}
                        onCalculate={calculateChecksum}
                    />
                )}

                <div className="dialog-actions">
                    {activeTab === "permissions" && (
                        <Button
                            text={permissionsSaving ? t('common.saving') : t('servers.fileManager.permissions.apply')}
                            onClick={handleSavePermissions}
                            disabled={permissionsSaving}
                            icon={permissionsSaving ? mdiLoading : undefined}
                        />
                    )}
                    <Button text={t("common.close")} onClick={onClose} type="primary" />
                </div>
            </div>
        </DialogProvider>
    );
};

