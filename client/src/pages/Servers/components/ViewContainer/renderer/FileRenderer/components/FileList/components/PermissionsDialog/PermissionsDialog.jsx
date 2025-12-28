import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiShieldLock, mdiContentCopy, mdiCheck } from "@mdi/js";
import { DialogProvider } from "@/common/components/Dialog";
import Button from "@/common/components/Button";
import Checkbox from "@/common/components/Checkbox";
import { parsePermissions, permissionsToMode, formatOctal } from "../../utils/fileUtils";
import "./styles.sass";

export const PermissionsDialog = ({ open, onClose, item, onSave }) => {
    const { t } = useTranslation();
    const [permissions, setPermissions] = useState(null);
    const [octalInput, setOctalInput] = useState("");
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (open && item) {
            const mode = item.mode ?? 0o644;
            const parsed = parsePermissions(mode);
            setPermissions(parsed);
            setOctalInput(formatOctal(mode));
        } else if (!open) {
            setPermissions(null);
            setOctalInput("");
        }
    }, [open, item?.name, item?.mode]);

    const handleToggle = useCallback((category, permission) => {
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
    }, []);

    const handleOctalChange = useCallback((value) => {
        const cleaned = value.replace(/[^0-7]/g, '').slice(0, 3);
        setOctalInput(cleaned);
        
        if (cleaned.length === 3) {
            const mode = parseInt(cleaned, 8);
            setPermissions(parsePermissions(mode));
        }
    }, []);

    const handleSave = useCallback(() => {
        if (permissions) {
            const mode = permissionsToMode(permissions);
            onSave(mode);
        }
        onClose();
    }, [permissions, onSave, onClose]);

    const handleCopyOctal = useCallback(() => {
        navigator.clipboard.writeText(octalInput);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }, [octalInput]);

    if (!permissions) return <DialogProvider open={open} onClose={onClose}><div /></DialogProvider>;

    const categories = [
        { key: 'owner', label: t('servers.fileManager.permissions.owner', 'Owner') },
        { key: 'group', label: t('servers.fileManager.permissions.group', 'Group') },
        { key: 'others', label: t('servers.fileManager.permissions.others', 'Others') },
    ];

    const permissionLabels = [
        { key: 'r', label: t('servers.fileManager.permissions.read', 'Read'), short: 'R' },
        { key: 'w', label: t('servers.fileManager.permissions.write', 'Write'), short: 'W' },
        { key: 'x', label: t('servers.fileManager.permissions.execute', 'Execute'), short: 'X' },
    ];

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="permissions-dialog">
                <div className="dialog-header">
                    <Icon path={mdiShieldLock} />
                    <h2>{t('servers.fileManager.permissions.title', 'Permissions')}</h2>
                </div>

                <div className="permissions-grid">
                    <div className="grid-header">
                        <div className="grid-cell" />
                        {permissionLabels.map(p => (
                            <div key={p.key} className="grid-cell permission-label" title={p.label}>
                                {p.short}
                            </div>
                        ))}
                    </div>
                    {categories.map(cat => (
                        <div key={cat.key} className="grid-row">
                            <div className="grid-cell category-label">{cat.label}</div>
                            {permissionLabels.map(perm => (
                                <div key={perm.key} className="grid-cell">
                                    <Checkbox
                                        id={`perm-${cat.key}-${perm.key}`}
                                        checked={permissions[cat.key][perm.key]}
                                        onChange={() => handleToggle(cat.key, perm.key)}
                                        size="medium"
                                    />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>

                <div className="octal-section">
                    <label>{t('servers.fileManager.permissions.octal', 'Octal')}</label>
                    <div className="octal-input-wrapper">
                        <input
                            type="text"
                            className="octal-input"
                            value={octalInput}
                            onChange={(e) => handleOctalChange(e.target.value)}
                            maxLength={3}
                            placeholder="755"
                        />
                        <Button
                            icon={copied ? mdiCheck : mdiContentCopy}
                            onClick={handleCopyOctal}
                            type={copied ? "primary" : undefined}
                        />
                    </div>
                </div>

                <div className="permissions-preview">
                    <span>{t('servers.fileManager.permissions.preview', 'Preview')}:</span>
                    <code>
                        {item?.type === 'folder' ? 'd' : '-'}
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

                <div className="dialog-actions">
                    <Button text={t('common.cancel', 'Cancel')} onClick={onClose} />
                    <Button text={t('common.save', 'Save')} onClick={handleSave} type="primary" />
                </div>
            </div>
        </DialogProvider>
    );
};
