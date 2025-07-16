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
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [loadingModels, setLoadingModels] = useState(false);
    const [availableModels, setAvailableModels] = useState([]);
    const [showApiKey, setShowApiKey] = useState(false);
    const { sendToast } = useToast();
    const { loadAISettings } = useAI();

    const providerOptions = [
        { value: "", label: t("settings.ai.selectProvider") },
        { value: "ollama", label: "Ollama" },
        { value: "openai", label: "OpenAI" },
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
        } catch (error) {
            setAvailableModels([]);
        } finally {
            setLoadingModels(false);
        }
    }, [settings.provider]);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const response = await getRequest("ai");
            setSettings(prev => ({ ...prev, ...response }));
        } catch (error) {
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
        } catch (error) {
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
        setSettings(prev => ({
            ...prev,
            provider: provider,
            model: "",
            apiUrl: provider === "ollama" ? "http://localhost:11434" : prev.apiUrl,
        }));
    }, []);

    const isConfigurationValid = () => {
        if (!settings.enabled) return false;
        if (!settings.provider) return false;
        if (!settings.model) return false;

        return !(settings.provider === "openai" && !settings.apiKey && !settings.hasApiKey);
    };

    useEffect(() => {
        loadSettings();
    }, []);

    useEffect(() => {
        if (settings.provider) {
            loadModels();
        } else {
            setAvailableModels([]);
        }
    }, [settings.provider, loadModels]);

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
                                                   selected={settings.model} />
                                    </div>
                                </div>

                                {settings.provider === "openai" && (
                                    <div className="setting-item">
                                        <div className="setting-label">
                                            <h4>{t("settings.ai.apiKey.title")}</h4>
                                            <p>{t("settings.ai.apiKey.description")}</p>
                                        </div>
                                        <div className="setting-input api-key-input">
                                            <IconInput
                                                icon={showApiKey ? mdiEyeOff : mdiEye}
                                                type={showApiKey ? "text" : "password"}
                                                value={settings.apiKey}
                                                setValue={(value) => handleInputChange("apiKey", value)}
                                                placeholder={settings.hasApiKey ? t("settings.ai.apiKey.setPlaceholder") : t("settings.ai.apiKey.placeholder")}
                                                onIconClick={() => setShowApiKey(!showApiKey)}
                                            />
                                        </div>
                                    </div>
                                )}

                                {settings.provider === "ollama" && (
                                    <div className="setting-item">
                                        <div className="setting-label">
                                            <h4>{t("settings.ai.ollamaUrl.title")}</h4>
                                            <p>{t("settings.ai.ollamaUrl.description")}</p>
                                        </div>
                                        <div className="setting-input">
                                            <IconInput icon={mdiRobot} value={settings.apiUrl}
                                                       setValue={(value) => handleInputChange("apiUrl", value)}
                                                       placeholder={t("settings.ai.ollamaUrl.placeholder")} />
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
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
