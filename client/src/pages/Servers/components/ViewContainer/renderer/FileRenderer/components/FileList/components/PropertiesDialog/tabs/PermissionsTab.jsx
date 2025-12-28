import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { mdiContentCopy, mdiCheck } from "@mdi/js";
import Checkbox from "@/common/components/Checkbox/index.js";
import Button from "@/common/components/Button/index.js";
import { formatOctal, permissionsToMode, parsePermissions } from "../../../utils/fileUtils.js";

export const PermissionsTab = ({
    isFolder,
    permissions,
    setPermissions,
    octalInput,
    setOctalInput,
    copied,
    onCopy,
}) => {
    const { t } = useTranslation();

    const permissionCategories = [
        { key: 'owner', label: t('servers.fileManager.permissions.owner') },
        { key: 'group', label: t('servers.fileManager.permissions.group') },
        { key: 'others', label: t('servers.fileManager.permissions.others') },
    ];

    const permissionLabels = [
        { key: 'r', label: t('servers.fileManager.permissions.read'), short: 'R' },
        { key: 'w', label: t('servers.fileManager.permissions.write'), short: 'W' },
        { key: 'x', label: t('servers.fileManager.permissions.execute'), short: 'X' },
    ];

    const handlePermissionToggle = useCallback((category, permission) => {
        setPermissions(prev => {
            const updated = {
                ...prev,
                [category]: {
                    ...prev[category],
                    [permission]: !prev[category][permission],
                },
            };
            setOctalInput(formatOctal(permissionsToMode(updated)));
            return updated;
        });
    }, [setPermissions, setOctalInput]);

    const handleOctalChange = useCallback((value) => {
        const cleaned = value.replace(/[^0-7]/g, '').slice(0, 3);
        setOctalInput(cleaned);
        if (cleaned.length === 3) {
            const mode = parseInt(cleaned, 8);
            setPermissions(parsePermissions(mode));
        }
    }, [setOctalInput, setPermissions]);

    if (!permissions) return null;

    return (
        <div className="properties-content permissions-content">
            <div className="permissions-grid">
                <div className="grid-header">
                    <div className="grid-cell" />
                    {permissionLabels.map(p => (
                        <div key={p.key} className="grid-cell permission-label" title={p.label}>
                            {p.short}
                        </div>
                    ))}
                </div>
                {permissionCategories.map(cat => (
                    <div key={cat.key} className="grid-row">
                        <div className="grid-cell category-label">{cat.label}</div>
                        {permissionLabels.map(perm => (
                            <div key={perm.key} className="grid-cell">
                                <Checkbox
                                    id={`perm-${cat.key}-${perm.key}`}
                                    checked={permissions[cat.key][perm.key]}
                                    onChange={() => handlePermissionToggle(cat.key, perm.key)}
                                    size="medium"
                                />
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            <div className="octal-section">
                <label>{t('servers.fileManager.permissions.octal')}</label>
                <div className="octal-input-wrapper">
                    <input
                        type="text"
                        className="octal-input"
                        value={octalInput}
                        onChange={(e) => handleOctalChange(e.target.value)}
                        maxLength={3}
                        placeholder="755"
                    />
                    <Button icon={copied === "octal" ? mdiCheck : mdiContentCopy} onClick={() => onCopy(octalInput, "octal")} type="primary" />
                </div>
            </div>

            <div className="permissions-preview">
                <span>{t('servers.fileManager.permissions.preview')}</span>
                <code>
                    {isFolder ? 'd' : '-'}
                    {permissions.owner.r ? 'r' : '-'}
                    {permissions.owner.w ? 'w' : '-'}
                    {permissions.owner.x ? 'x' : '-'}
                    {permissions.group.r ? 'r' : '-'}
                    {permissions.group.w ? 'w' : '-'}
                    {permissions.group.x ? 'x' : '-'}
                    {permissions.others.r ? 'r' : '-'}
                    {permissions.others.w ? 'w' : '-'}
                    {permissions.others.x ? 'x' : '-'}
                </code>
            </div>
        </div>
    );
};
