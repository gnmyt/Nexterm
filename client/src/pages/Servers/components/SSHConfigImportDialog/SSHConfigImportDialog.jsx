import { DialogProvider } from "@/common/components/Dialog";
import "./styles.sass";
import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import { IdentityContext } from "@/common/contexts/IdentityContext.jsx";
import { mdiFileDocumentOutline, mdiKey, mdiFileUploadOutline } from "@mdi/js";
import Button from "@/common/components/Button";
import { patchRequest, postRequest, putRequest } from "@/common/utils/RequestUtil.js";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import Icon from "@mdi/react";

const parseSSHConfig = (content) => {
    const hosts = [];
    const keyMappings = new Map();
    let currentHost = null;

    const finishHost = () => {
        if (currentHost) hosts.push(currentHost);
        currentHost = null;
    };

    content.split("\n").forEach(line => {
        line = line.trim();
        if (!line || line.startsWith("#")) return;

        const hostMatch = line.match(/^Host\s+(.+)$/i);
        if (hostMatch) {
            finishHost();
            const hostPattern = hostMatch[1].trim();
            if (hostPattern === "*" || hostPattern.includes("*")) return;
            currentHost = {
                name: hostPattern,
                hostname: hostPattern,
                port: 22,
                user: null,
                identityFiles: [],
                certificateFiles: [],
                config: {},
            };
            return;
        }

        if (!currentHost) return;
        const configMatch = line.match(/^(\w+)\s+(.+)$/);
        if (!configMatch) return;

        const [, key, rawValue] = configMatch;
        const normalizedKey = key.toLowerCase();
        const value = rawValue.trim().replace(/^['"]|['"]$/g, "");

        if (normalizedKey === "hostname") currentHost.hostname = value;
        else if (normalizedKey === "port") currentHost.port = parseInt(value) || 22;
        else if (normalizedKey === "user") currentHost.user = value;
        else if (normalizedKey === "identityfile" && value && !value.includes("*")) currentHost.identityFiles.push(value);
        else if (normalizedKey === "certificatefile" && value && !value.includes("*")) currentHost.certificateFiles.push(value);
        else if (normalizedKey !== "identityfile" && normalizedKey !== "certificatefile") currentHost.config[key] = value;
    });

    finishHost();

    hosts.forEach(host => {
        host.identityFiles.forEach((path, index) => {
            const uniqueKey = `${path}|${host.user || "no-user"}`;
            const certificatePath = host.certificateFiles[index] || host.certificateFiles[0] || null;
            if (!keyMappings.has(uniqueKey)) {
                keyMappings.set(uniqueKey, {
                    path,
                    username: host.user || null,
                    name: path.split("/").pop() || path,
                    certificatePath,
                });
            } else if (!keyMappings.get(uniqueKey).certificatePath) {
                keyMappings.get(uniqueKey).certificatePath = certificatePath;
            }
        });
    });

    const pathGroups = new Map();
    keyMappings.forEach((keyInfo, uniqueKey) => {
        if (!pathGroups.has(keyInfo.path)) pathGroups.set(keyInfo.path, []);
        pathGroups.get(keyInfo.path).push({ uniqueKey, keyInfo });
    });

    const keyFiles = {};
    keyMappings.forEach((keyInfo, uniqueKey) => {
        const pathGroup = pathGroups.get(keyInfo.path);
        const name = pathGroup.length > 1 && keyInfo.username
            ? `${keyInfo.name} (${keyInfo.username})`
            : keyInfo.name;
        keyFiles[uniqueKey] = {
            ...keyInfo,
            name,
            identityId: null,
            uploaded: false,
            certificateContent: null,
            certificateUploaded: false,
        };
    });

    return { hosts, keyFiles };
};

export const SSHConfigImportDialog = ({ open, onClose, currentFolderId, currentOrganizationId }) => {
    const { t } = useTranslation();
    const [configContent, setConfigContent] = useState("");
    const [isImporting, setIsImporting] = useState(false);
    const [keyFiles, setKeyFiles] = useState({});

    const { loadServers } = useContext(ServerContext);
    const { loadIdentities } = useContext(IdentityContext);
    const { sendToast } = useToast();

    const parseKeyFiles = (content) => {
        setKeyFiles(parseSSHConfig(content).keyFiles);
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
                        ...(keyInfo.certificateContent && { sshCertificate: keyInfo.certificateContent }),
                        ...(keyInfo.username && { username: keyInfo.username })
                    };

                    const result = await putRequest('identities', identityData);
                    if (result.id) {
                        setKeyFiles(prev => ({
                            ...prev,
                            [uniqueKey]: {
                                ...prev[uniqueKey],
                                identityId: result.id,
                                uploaded: true,
                                certificateUploaded: !!keyInfo.certificateContent,
                            }
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

    const handleCertificateUpload = async (uniqueKey) => {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = ".pub,.crt,.cert,text/plain";
        fileInput.onchange = async () => {
            const file = fileInput.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const certificate = e.target.result;
                    const keyInfo = keyFiles[uniqueKey];
                    if (keyInfo.identityId) await patchRequest(`identities/${keyInfo.identityId}`, { sshCertificate: certificate });
                    setKeyFiles(prev => ({
                        ...prev,
                        [uniqueKey]: { ...prev[uniqueKey], certificateContent: certificate, certificateUploaded: true },
                    }));
                    if (keyInfo.identityId) await loadIdentities();
                    sendToast("Success", t("servers.sshConfigImport.messages.certificateUploadSuccess", { name: keyInfo.name }));
                } catch (error) {
                    sendToast("Error", t("servers.sshConfigImport.messages.certificateUploadFailed", { name: keyFiles[uniqueKey].name }));
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
            const { hosts } = parseSSHConfig(configContent);

            const serverData = hosts.map(host => {
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

            const result = await postRequest("entries/import/ssh-config", {
                servers: serverData,
                folderId: currentFolderId,
                organizationId: currentOrganizationId
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
                                            {keyInfo.certificatePath && (
                                                <span className="key-path">{t('servers.sshConfigImport.keyFiles.certificateLabel', { path: keyInfo.certificatePath })}</span>
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
                                        {keyInfo.certificatePath && (keyInfo.certificateUploaded ? (
                                            <span className="uploaded-indicator">{t('servers.sshConfigImport.keyFiles.certificateUploaded')}</span>
                                        ) : (
                                            <Button
                                                text={t('servers.sshConfigImport.keyFiles.certificateUploadButton')}
                                                icon={mdiFileUploadOutline}
                                                onClick={() => handleCertificateUpload(uniqueKey)}
                                                variant="secondary"
                                                size="small"
                                            />
                                        ))}
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
