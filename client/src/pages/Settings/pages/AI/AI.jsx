import "./styles.sass";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { getRequest, patchRequest, postRequest } from "@/common/utils/RequestUtil.js";
import Button from "@/common/components/Button";
import ToggleSwitch from "@/common/components/ToggleSwitch";
import IconInput from "@/common/components/IconInput";
import SelectBox from "@/common/components/SelectBox";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { useAI } from "@/common/contexts/AIContext.jsx";
import { mdiRobot, mdiTestTube, mdiEye, mdiEyeOff } from "@mdi/js";

export const AI = () => {
    const { t } = useTranslation();
    const [settings, setSettings] = useState({
        enabled: false,
        provider: "",
        model: "",
        apiKey: "",
        apiUrl: "http://localhost:11434",
        hasApiKey: false,
        anthropicAuthMethod: "api_key",
        subscriptionConnected: false,
        requireConfirmation: true,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [loadingModels, setLoadingModels] = useState(false);
    const [availableModels, setAvailableModels] = useState([]);
    const [showApiKey, setShowApiKey] = useState(false);
    const [oauthCode, setOauthCode] = useState("");
    const [connecting, setConnecting] = useState(false);
    const [providers, setProviders] = useState([]);
    const { sendToast } = useToast();
    const { loadAISettings } = useAI();

    const providerOptions = useMemo(() => [
        { value: "", label: t("settings.ai.selectProvider") },
        ...providers.map(p => ({ value: p.id, label: p.label })),
    ], [providers, t]);

    const currentProvider = useMemo(
        () => providers.find(p => p.id === settings.provider) || null,
        [providers, settings.provider]);

    const authMethodOptions = [
        { value: "api_key", label: t("settings.ai.authMethod.apiKey") },
        { value: "subscription", label: t("settings.ai.authMethod.subscription") },
    ];

    const modelOptions = useMemo(() => {
        if (!settings.provider) return [{ value: "", label: t("settings.ai.selectModel") }];
        if (loadingModels) return [{ value: "", label: t("settings.ai.loadingModels") }];

        if (availableModels.length > 0) {
            return [{ value: "", label: t("settings.ai.selectModel") }, ...availableModels.map(model => ({
                value: model,
                label: model,
            }))];
        } else {
            return [{ value: "", label: t("settings.ai.noModels") }];
        }
    }, [settings.provider, loadingModels, availableModels, t]);

    const loadModels = useCallback(async () => {
        if (!settings.provider) return;

        try {
            setLoadingModels(true);
            const response = await getRequest("ai/models");
            setAvailableModels(response.models || []);
        } catch {
            setAvailableModels([]);
        } finally {
            setLoadingModels(false);
        }
    }, [settings.provider]);

    const loadProviders = useCallback(async () => {
        try {
            const response = await getRequest("ai/providers");
            setProviders(response.providers || []);
        } catch {
            setProviders([]);
        }
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const response = await getRequest("ai");
            setSettings(prev => ({ ...prev, ...response }));
        } catch {
            sendToast(t("common.error"), t("settings.ai.errors.loadSettings"));
        } finally {
            setLoading(false);
        }
    };

    const saveSettings = async () => {
        try {
            setSaving(true);
            const updateData = {
                enabled: settings.enabled,
                provider: settings.provider || null,
                model: settings.model || null,
                apiUrl: settings.apiUrl || null,
                anthropicAuthMethod: settings.anthropicAuthMethod,
                requireConfirmation: settings.requireConfirmation,
            };

            if (updateData.provider === "") updateData.provider = null;
            if (updateData.model === "") updateData.model = null;
            if (updateData.apiUrl === "") updateData.apiUrl = null;

            const apiKeyChanged = settings.apiKey && settings.apiKey !== "";
            if (apiKeyChanged) updateData.apiKey = settings.apiKey;

            const response = await patchRequest("ai", updateData);

            if (settings.provider) loadModels();

            setSettings(prev => ({ ...prev, ...response }));
            sendToast(t("common.success"), t("settings.ai.saveSuccess"));

            loadAISettings();
        } catch {
            sendToast(t("common.error"), t("settings.ai.errors.saveSettings"));
        } finally {
            setSaving(false);
        }
    };

    const testConnection = async () => {
        try {
            setTesting(true);
            await postRequest("ai/test");
            sendToast(t("common.success"), t("settings.ai.testSuccess"));
        } catch (error) {
            sendToast(t("common.error"), error.message || t("settings.ai.errors.testConnection"));
        } finally {
            setTesting(false);
        }
    };

    const handleInputChange = useCallback((field, value) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    }, []);

    const handleProviderChange = useCallback((provider) => {
        const descriptor = providers.find(p => p.id === provider);
        setSettings(prev => ({
            ...prev,
            provider: provider,
            model: "",
            apiUrl: descriptor?.fields?.baseUrl ? (descriptor.fields.baseUrl.default || "") : prev.apiUrl,
        }));
    }, [providers]);

    const startSubscriptionConnect = async () => {
        try {
            setConnecting(true);
            const response = await postRequest("ai/oauth/start");
            if (response.authUrl) window.open(response.authUrl, "_blank", "noopener,noreferrer");
        } catch {
            sendToast(t("common.error"), t("settings.ai.subscription.startError"));
        } finally {
            setConnecting(false);
        }
    };

    const completeSubscriptionConnect = async () => {
        if (!oauthCode.trim()) return;
        try {
            setConnecting(true);
            await postRequest("ai/oauth/exchange", { code: oauthCode.trim() });
            setSettings(prev => ({ ...prev, subscriptionConnected: true }));
            setOauthCode("");
            sendToast(t("common.success"), t("settings.ai.subscription.connectSuccess"));
            loadModels();
        } catch (error) {
            sendToast(t("common.error"), error.message || t("settings.ai.subscription.exchangeError"));
        } finally {
            setConnecting(false);
        }
    };

    const disconnectSubscription = async () => {
        try {
            await postRequest("ai/oauth/disconnect");
            setSettings(prev => ({ ...prev, subscriptionConnected: false, model: "" }));
            setAvailableModels([]);
        } catch {
            sendToast(t("common.error"), t("settings.ai.subscription.disconnectError"));
        }
    };

    const isConfigurationValid = () => {
        if (!settings.enabled || !settings.provider || !settings.model) return false;
        if (!currentProvider) return false;

        const { fields } = currentProvider;
        if (fields.subscription && settings.anthropicAuthMethod === "subscription") return settings.subscriptionConnected;
        if (fields.baseUrl && !settings.apiUrl && !fields.baseUrl.default) return false;
        if (fields.apiKey && !settings.apiKey && !settings.hasApiKey) return false;
        return true;
    };

    useEffect(() => {
        loadSettings();
        loadProviders();
    }, [loadProviders]);

    useEffect(() => {
        if (settings.provider) {
            loadModels();
        } else {
            setAvailableModels([]);
        }
    }, [settings.provider, loadModels]);

    const renderApiKeyField = () => (
        <div className="setting-item">
            <div className="setting-label">
                <h4>{t("settings.ai.apiKey.title")}</h4>
                <p>{t("settings.ai.apiKey.genericDescription")}</p>
            </div>
            <div className="setting-input api-key-input">
                <IconInput
                    icon={showApiKey ? mdiEyeOff : mdiEye}
                    type={showApiKey ? "text" : "password"}
                    value={settings.apiKey}
                    setValue={(value) => handleInputChange("apiKey", value)}
                    placeholder={settings.hasApiKey
                        ? t("settings.ai.apiKey.setPlaceholder")
                        : t("settings.ai.apiKey.genericPlaceholder", { provider: currentProvider?.label || "" })}
                    onIconClick={() => setShowApiKey(!showApiKey)}
                />
            </div>
        </div>
    );

    if (loading) return <div className="ai-settings-loading">{t("settings.ai.loading")}</div>;

    return (
        <div className="ai-settings">
            <div className="settings-section">
                <h2>{t("settings.ai.title")}</h2>
                <p>{t("settings.ai.description")}</p>

                <div className="setting-item">
                    <div className="setting-label">
                        <h4>{t("settings.ai.enable.title")}</h4>
                        <p>{t("settings.ai.enable.description")}</p>
                    </div>
                    <ToggleSwitch onChange={(enabled) => handleInputChange("enabled", enabled)} id="ai-enabled"
                                  checked={settings.enabled} />
                </div>

                {settings.enabled && (
                    <>
                        <div className="setting-item">
                            <div className="setting-label">
                                <h4>{t("settings.ai.provider.title")}</h4>
                                <p>{t("settings.ai.provider.description")}</p>
                            </div>
                            <div className="setting-input">
                                <SelectBox options={providerOptions} selected={settings.provider}
                                           setSelected={handleProviderChange} />
                            </div>
                        </div>

                        {settings.provider && (
                            <>
                                <div className="setting-item">
                                    <div className="setting-label">
                                        <h4>{t("settings.ai.model.title")}</h4>
                                        <p>{t("settings.ai.model.description")}</p>
                                    </div>
                                    <div className="setting-input">
                                        <SelectBox setSelected={(model) => handleInputChange("model", model)}
                                                   disabled={loadingModels} options={modelOptions}
                                                   selected={settings.model}
                                                   searchable={availableModels.length > 5} />
                                    </div>
                                </div>

                                {currentProvider?.fields?.subscription ? (
                                    <>
                                        <div className="setting-item">
                                            <div className="setting-label">
                                                <h4>{t("settings.ai.authMethod.title")}</h4>
                                                <p>{t("settings.ai.authMethod.description")}</p>
                                            </div>
                                            <div className="setting-input">
                                                <SelectBox options={authMethodOptions}
                                                           selected={settings.anthropicAuthMethod}
                                                           setSelected={(value) => handleInputChange("anthropicAuthMethod", value)} />
                                            </div>
                                        </div>

                                        {settings.anthropicAuthMethod === "subscription" ? (
                                            <div className="setting-item">
                                                <div className="setting-label">
                                                    <h4>{t("settings.ai.subscription.title")}</h4>
                                                    <p>{settings.subscriptionConnected ? t("settings.ai.subscription.connectedDescription") : t("settings.ai.subscription.description")}</p>
                                                </div>
                                                <div className="setting-input subscription-connect">
                                                    {settings.subscriptionConnected ? (
                                                        <Button text={t("settings.ai.subscription.disconnect")} type="secondary"
                                                                onClick={disconnectSubscription} />
                                                    ) : (
                                                        <>
                                                            <Button text={connecting ? t("settings.ai.subscription.connecting") : t("settings.ai.subscription.connect")}
                                                                    type="primary" disabled={connecting} onClick={startSubscriptionConnect} />
                                                            <div className="code-row">
                                                                <IconInput icon={mdiRobot} value={oauthCode}
                                                                           setValue={setOauthCode}
                                                                           placeholder={t("settings.ai.subscription.codePlaceholder")} />
                                                                <Button text={t("settings.ai.subscription.complete")} type="secondary"
                                                                        disabled={connecting || !oauthCode.trim()} onClick={completeSubscriptionConnect} />
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ) : renderApiKeyField()}
                                    </>
                                ) : (
                                    <>
                                        {currentProvider?.fields?.baseUrl && (
                                            <div className="setting-item">
                                                <div className="setting-label">
                                                    <h4>{t("settings.ai.baseUrl.title")}</h4>
                                                    <p>{t("settings.ai.baseUrl.description")}</p>
                                                </div>
                                                <div className="setting-input">
                                                    <IconInput icon={mdiRobot} value={settings.apiUrl}
                                                               setValue={(value) => handleInputChange("apiUrl", value)}
                                                               placeholder={currentProvider.fields.baseUrl.default || t("settings.ai.baseUrl.placeholder")} />
                                                </div>
                                            </div>
                                        )}

                                        {currentProvider?.fields?.apiKey && renderApiKeyField()}
                                    </>
                                )}
                            </>
                        )}

                        <div className="setting-item">
                            <div className="setting-label">
                                <h4>{t("settings.ai.requireConfirmation.title")}</h4>
                                <p>{t("settings.ai.requireConfirmation.description")}</p>
                            </div>
                            <ToggleSwitch onChange={(value) => handleInputChange("requireConfirmation", value)}
                                          id="ai-require-confirmation" checked={settings.requireConfirmation} />
                        </div>
                    </>
                )}
            </div>

            <div className="settings-actions">
                <Button text={t("settings.ai.saveSettings")} icon={mdiRobot} onClick={saveSettings} disabled={saving} type="primary" />

                {isConfigurationValid() && (
                    <Button text={testing ? t("settings.ai.testing") : t("settings.ai.testConnection")} icon={mdiTestTube}
                            onClick={testConnection} disabled={testing} type="secondary" />
                )}
            </div>
        </div>
    );
};
