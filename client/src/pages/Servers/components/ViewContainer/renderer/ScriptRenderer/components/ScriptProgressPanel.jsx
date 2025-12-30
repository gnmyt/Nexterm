import Icon from "@mdi/react";
import { mdiScript, mdiCheck, mdiClose, mdiLoading, mdiMinus, mdiStop, mdiCheckCircle, mdiAlertCircle } from "@mdi/js";
import Button from "@/common/components/Button";
import { useTranslation } from "react-i18next";

const StepIndicator = ({ type, progressValue }) => {
    const radius = 8;
    const circumference = 2 * Math.PI * radius;
    const progress = circumference - (progressValue / 100) * circumference;

    if (type === "success") {
        return (
            <div className="step-indicator success">
                <Icon path={mdiCheck} />
            </div>
        );
    }

    if (type === "error") {
        return (
            <div className="step-indicator error">
                <Icon path={mdiClose} />
            </div>
        );
    }

    if (type === "loading") {
        return (
            <div className="step-indicator loading">
                <Icon path={mdiLoading} spin />
            </div>
        );
    }

    if (type === "progress") {
        return (
            <div className="step-indicator progress">
                <svg width="20" height="20" viewBox="0 0 20 20">
                    <circle
                        className="progress-bg"
                        cx="10"
                        cy="10"
                        r={radius}
                        fill="none"
                        strokeWidth="2"
                    />
                    <circle
                        className="progress-bar"
                        cx="10"
                        cy="10"
                        r={radius}
                        fill="none"
                        strokeWidth="2"
                        strokeDasharray={circumference}
                        strokeDashoffset={progress}
                    />
                </svg>
            </div>
        );
    }

    if (type === "skip") {
        return (
            <div className="step-indicator skip">
                <Icon path={mdiMinus} />
            </div>
        );
    }

    return (
        <div className="step-indicator pending">
            <div className="dot" />
        </div>
    );
};

const ScriptProgressPanel = ({
                                 scriptName,
                                 steps,
                                 failedStep,
                                 isCompleted,
                                 currentProgress,
                                 getTypeByIndex,
                                 onCancel,
                             }) => {
    const { t } = useTranslation();

    const getStatusInfo = () => {
        if (failedStep) return { text: t("scripts.execution.status.error"), type: "error", icon: mdiAlertCircle };
        if (isCompleted) return {
            text: t("scripts.execution.status.completed"),
            type: "success",
            icon: mdiCheckCircle,
        };
        return { text: t("scripts.execution.status.running"), type: "running", icon: mdiLoading };
    };

    const status = getStatusInfo();

    return (
        <div className="script-progress-panel">
            <div className="panel-header">
                <div className="header-icon">
                    <Icon path={mdiScript} />
                </div>
                <div className="header-content">
                    <h3 className="script-name" title={scriptName}>{scriptName}</h3>
                    <div className={`status-badge ${status.type}`}>
                        <Icon path={status.icon} spin={status.type === "running"} />
                        <span>{status.text}</span>
                    </div>
                </div>
            </div>

            <div className="steps-container">
                <div className="steps-label">{t("scripts.execution.progressPanel.steps")}</div>
                <div className="steps-list">
                    {steps.map((step, index) => {
                        const type = getTypeByIndex(index);
                        return (
                            <div key={index} className={`step-item ${type}`} title={step}>
                                <StepIndicator type={type} progressValue={currentProgress} />
                                <span className="step-text">{step}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {!isCompleted && !failedStep && (
                <div className="panel-actions">
                    <Button
                        text={t("common.actions.cancel")}
                        icon={mdiStop}
                        onClick={onCancel}
                        type="danger"
                    />
                </div>
            )}
        </div>
    );
};

export default ScriptProgressPanel;
