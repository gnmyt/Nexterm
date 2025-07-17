import { DialogProvider } from "@/common/components/Dialog";
import "./styles.sass";
import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import { IdentityContext } from "@/common/contexts/IdentityContext.jsx";
import { mdiFileDocumentOutline, mdiKey, mdiFileUploadOutline } from "@mdi/js";
import Button from "@/common/components/Button";
import { postRequest, putRequest } from "@/common/utils/RequestUtil.js";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import Icon from "@mdi/react";

export const SSHConfigImportDialog = ({ open, onClose, currentFolderId }) => {
    const { t } = useTranslation();
    const [configContent, setConfigContent] = useState("");
    const [isImporting, setIsImporting] = useState(false);
    const [keyFiles, setKeyFiles] = useState({});

    const { loadServers } = useContext(ServerContext);
    const { loadIdentities } = useContext(IdentityContext);
    const { sendToast } = useToast();

    const parseKeyFiles = (content) => {
        if (!content.trim()) return setKeyFiles({});

        const keyMappings = new Map();
        const lines = content.split('\n');
        let currentHost = null;

        lines.forEach(line => {
            line = line.trim();
            if (!line || line.startsWith('#')) return;

            const hostMatch = line.match(/^Host\s+(.+)$/i);
            if (hostMatch) {
                const hostPattern = hostMatch[1].trim();
                currentHost = (hostPattern === '*' || hostPattern.includes('*')) ? null : { name: hostPattern, user: null };
                return;
            }

            if (!currentHost) return;

            const configMatch = line.match(/^(\w+)\s+(.+)$/);
            if (!configMatch) return;

            const [, key, value] = configMatch;
            const normalizedKey = key.toLowerCase();
            
            if (normalizedKey === 'user') {
                currentHost.user = value;
            } else if (normalizedKey === 'identityfile') {
                const keyPath = value.trim().replace(/^["']|["']$/g, '');
                if (keyPath && !keyPath.includes('*')) {
                    const uniqueKey = `${keyPath}|${currentHost.user || 'no-user'}`;
                    if (!keyMappings.has(uniqueKey)) {
                        keyMappings.set(uniqueKey, {
                            path: keyPath,
                            username: currentHost.user || null,
                            name: keyPath.split('/').pop() || keyPath
                        });
                    }
                }
            }
        });

        const pathGroups = new Map();
        keyMappings.forEach((keyInfo, uniqueKey) => {
            const path = keyInfo.path;
            if (!pathGroups.has(path)) pathGroups.set(path, []);
            pathGroups.get(path).push({ uniqueKey, keyInfo });
        });

        const newKeyFiles = {};
        keyMappings.forEach((keyInfo, uniqueKey) => {
            const pathGroup = pathGroups.get(keyInfo.path);
            const finalName = (pathGroup.length > 1 && keyInfo.username) 
                ? `${keyInfo.name} (${keyInfo.username})` 
                : keyInfo.name;
            
            newKeyFiles[uniqueKey] = { ...keyInfo, name: finalName, identityId: null, uploaded: false };
        });

        setKeyFiles(newKeyFiles);
    };

    const handleKeyUpload = async (uniqueKey) => {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.onchange = async () => {
            const file = fileInput.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const keyInfo = keyFiles[uniqueKey];
                    const identityData = {
                        name: keyInfo.name,
                        type: "ssh",
                        sshKey: e.target.result,
                        ...(keyInfo.username && { username: keyInfo.username })
                    };

                    const result = await putRequest('identities', identityData);
                    if (result.id) {
                        setKeyFiles(prev => ({
                            ...prev,
                            [uniqueKey]: { ...prev[uniqueKey], identityId: result.id, uploaded: true }
                        }));
                        await loadIdentities();
                        sendToast("Success", t('servers.sshConfigImport.messages.uploadSuccess', { name: keyInfo.name }));
                    }
                } catch (error) {
                    sendToast("Error", t('servers.sshConfigImport.messages.uploadFailed', { name: keyFiles[uniqueKey].name }));
                }
            };
            reader.readAsText(file);
        };
        fileInput.click();
    };

    const importConfig = async () => {
        if (!configContent.trim()) return sendToast("Error", t('servers.sshConfigImport.messages.noContent'));
        if (!currentFolderId) return sendToast("Error", t('servers.sshConfigImport.messages.noFolder'));

        setIsImporting(true);

        try {
            const servers = [];
            const lines = configContent.split('\n');
            let currentHost = null;

            lines.forEach(line => {
                line = line.trim();
                if (!line || line.startsWith('#')) return;

                const hostMatch = line.match(/^Host\s+(.+)$/i);
                if (hostMatch) {
                    if (currentHost) servers.push(currentHost);
                    const hostPattern = hostMatch[1].trim();
                    currentHost = (hostPattern === '*' || hostPattern.includes('*')) ? null : 
                        { name: hostPattern, hostname: hostPattern, port: 22, user: null, identityFiles: [], config: {} };
                    return;
                }

                if (!currentHost) return;
                const configMatch = line.match(/^(\w+)\s+(.+)$/);
                if (!configMatch) return;

                const [, key, value] = configMatch;
                const normalizedKey = key.toLowerCase();
                if (normalizedKey === 'hostname') currentHost.hostname = value;
                else if (normalizedKey === 'port') currentHost.port = parseInt(value) || 22;
                else if (normalizedKey === 'user') currentHost.user = value;
                else if (normalizedKey === 'identityfile') {
                    const keyPath = value.trim().replace(/^["']|["']$/g, '');
                    if (keyPath && !keyPath.includes('*')) currentHost.identityFiles.push(keyPath);
                } else if (normalizedKey !== 'user' && normalizedKey !== 'identityfile') {
                    currentHost.config[key] = value;
                }
            });

            if (currentHost) servers.push(currentHost);

            const serverData = servers.map(host => {
                const identities = [];
                host.identityFiles.forEach(keyPath => {
                    const uniqueKey = `${keyPath}|${host.user || 'no-user'}`;
                    if (keyFiles[uniqueKey]?.identityId) {
                        identities.push(keyFiles[uniqueKey].identityId);
                    }
                });

                return {
                    name: host.name,
                    ip: host.hostname,
                    port: host.port,
                    config: host.config,
                    identities
                };
            });

            const result = await postRequest("servers/import/ssh-config", {
                servers: serverData,
                folderId: currentFolderId
            });

            if (result.code) {
                sendToast("Error", result.message);
            } else {
                sendToast("Success", result.message);
                await loadServers();
                onClose();
                resetForm();
            }
        } catch (error) {
            sendToast("Error", t('servers.sshConfigImport.messages.importFailed'));
        } finally {
            setIsImporting(false);
        }
    };

    const resetForm = () => {
        setConfigContent("");
        setKeyFiles({});
    };

    useEffect(() => { if (!open) resetForm(); }, [open]);
    useEffect(() => { parseKeyFiles(configContent); }, [configContent]);

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="ssh-config-import-dialog">
                <h2>{t('servers.sshConfigImport.title')}</h2>
                
                <div className="form-group">
                    <label htmlFor="config-content">{t('servers.sshConfigImport.configContent.label')}</label>
                    <textarea
                        id="config-content"
                        placeholder={t('servers.sshConfigImport.configContent.placeholder')}
                        value={configContent}
                        onChange={(e) => {
                            setConfigContent(e.target.value);
                            parseKeyFiles(e.target.value);
                        }}
                        rows={10}
                    />
                </div>

                {Object.keys(keyFiles).length > 0 && (
                    <div className="form-group">
                        <label>{t('servers.sshConfigImport.keyFiles.label', { count: Object.keys(keyFiles).length })}</label>
                        <div className="key-files-section">
                            {Object.entries(keyFiles).map(([uniqueKey, keyInfo]) => (
                                <div key={uniqueKey} className="key-file-item">
                                    <div className="key-info">
                                        <Icon path={mdiKey} size={0.8} />
                                        <div className="key-details">
                                            <span className="key-name">{keyInfo.name}</span>
                                            <span className="key-path">{keyInfo.path}</span>
                                            {keyInfo.username && (
                                                <span className="key-username">{t('servers.sshConfigImport.keyFiles.userLabel', { username: keyInfo.username })}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="key-actions">
                                        {keyInfo.uploaded ? (
                                            <span className="uploaded-indicator">{t('servers.sshConfigImport.keyFiles.uploaded')}</span>
                                        ) : (
                                            <Button
                                                text={t('servers.sshConfigImport.keyFiles.uploadButton')}
                                                icon={mdiFileUploadOutline}
                                                onClick={() => handleKeyUpload(uniqueKey)}
                                                variant="primary"
                                                size="small"
                                            />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="dialog-actions">
                    <Button 
                        text={t('servers.sshConfigImport.actions.cancel')} 
                        onClick={onClose} 
                        variant="secondary" 
                    />
                    <Button 
                        text={isImporting ? t('servers.sshConfigImport.actions.importing') : t('servers.sshConfigImport.actions.import')} 
                        onClick={importConfig} 
                        icon={mdiFileDocumentOutline} 
                        disabled={isImporting || !configContent.trim()}
                    />
                </div>
            </div>
        </DialogProvider>
    );
};
