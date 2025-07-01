import "./styles.sass";
import { useEffect, useState, useCallback, useMemo } from "react";
import { getRequest, patchRequest, postRequest } from "@/common/utils/RequestUtil.js";
import Button from "@/common/components/Button";
import ToggleSwitch from "@/common/components/ToggleSwitch";
import IconInput from "@/common/components/IconInput";
import SelectBox from "@/common/components/SelectBox";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { useAI } from "@/common/contexts/AIContext.jsx";
import { mdiRobot, mdiTestTube, mdiEye, mdiEyeOff } from "@mdi/js";

export const AI = () => {
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
        { value: "", label: "Select a provider..." },
        { value: "ollama", label: "Ollama" },
        { value: "openai", label: "OpenAI" },
    ];

    const modelOptions = useMemo(() => {
        if (!settings.provider) return [{ value: "", label: "Select a model..." }];
        if (loadingModels) return [{ value: "", label: "Loading models..." }];

        if (availableModels.length > 0) {
            return [{ value: "", label: "Select a model..." }, ...availableModels.map(model => ({
                value: model,
                label: model,
            }))];
        } else {
            return [{ value: "", label: "No models available" }];
        }
    }, [settings.provider, loadingModels, availableModels]);

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
            sendToast("Error", "Failed to load AI settings");
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
            sendToast("Success", "AI settings saved successfully");

            loadAISettings();
        } catch (error) {
            sendToast("Error", "Failed to save AI settings");
        } finally {
            setSaving(false);
        }
    };

    const testConnection = async () => {
        try {
            setTesting(true);
            await postRequest("ai/test");
            sendToast("Success", "AI connection test successful");
        } catch (error) {
            sendToast("Error", error.message || "AI connection test failed");
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

    if (loading) return <div className="ai-settings-loading">Loading AI settings...</div>;

    return (
        <div className="ai-settings">
            <div className="settings-section">
                <h2>AI Assistant Configuration</h2>
                <p>Configure AI-powered command generation for terminal sessions and snippet creation.</p>

                <div className="setting-item">
                    <div className="setting-label">
                        <h4>Enable AI Assistant</h4>
                        <p>Allow users to generate commands using AI</p>
                    </div>
                    <ToggleSwitch onChange={(enabled) => handleInputChange("enabled", enabled)} id="ai-enabled"
                                  checked={settings.enabled} />
                </div>

                {settings.enabled && (
                    <>
                        <div className="setting-item">
                            <div className="setting-label">
                                <h4>AI Provider</h4>
                                <p>Choose your AI service provider</p>
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
                                        <h4>Model</h4>
                                        <p>Select the AI model to use for command generation</p>
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
                                            <h4>API Key</h4>
                                            <p>Your OpenAI API key for authentication</p>
                                        </div>
                                        <div className="setting-input api-key-input">
                                            <IconInput
                                                icon={showApiKey ? mdiEyeOff : mdiEye}
                                                type={showApiKey ? "text" : "password"}
                                                value={settings.apiKey}
                                                setValue={(value) => handleInputChange("apiKey", value)}
                                                placeholder={settings.hasApiKey ? "API key is set (leave blank to keep current)" : "Enter your OpenAI API key"}
                                                onIconClick={() => setShowApiKey(!showApiKey)}
                                            />
                                        </div>
                                    </div>
                                )}

                                {settings.provider === "ollama" && (
                                    <div className="setting-item">
                                        <div className="setting-label">
                                            <h4>Ollama URL</h4>
                                            <p>The URL where your Ollama instance is running</p>
                                        </div>
                                        <div className="setting-input">
                                            <IconInput icon={mdiRobot} value={settings.apiUrl}
                                                       setValue={(value) => handleInputChange("apiUrl", value)}
                                                       placeholder="http://localhost:11434" />
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>

            <div className="settings-actions">
                <Button text="Save Settings" icon={mdiRobot} onClick={saveSettings} disabled={saving} type="primary" />

                {isConfigurationValid() && (
                    <Button text={testing ? "Testing..." : "Test Connection"} icon={mdiTestTube}
                            onClick={testConnection} disabled={testing} type="secondary" />
                )}
            </div>
        </div>
    );
};
