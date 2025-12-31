import { useState, useRef, useEffect } from "react";
import Icon from "@mdi/react";
import { 
    mdiCheck, 
    mdiClose, 
    mdiLoading, 
    mdiMinus, 
    mdiStop, 
    mdiChevronUp, 
    mdiChevronDown,
    mdiCheckCircle,
    mdiAlertCircle
} from "@mdi/js";
import { useTranslation } from "react-i18next";
import "./ScriptOverlay.sass";

const StepIndicator = ({ type, progressValue, stepNumber }) => {
    const radius = 8;
    const size = 20;
    const circumference = 2 * Math.PI * radius;
    const progress = circumference - (progressValue / 100) * circumference;

    const iconMap = {
        success: mdiCheck,
        error: mdiClose,
        loading: mdiLoading,
        skip: mdiMinus,
    };

    if (type === "progress") {
        return (
            <div className="step-indicator progress">
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    <circle
                        className="progress-bg"
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        strokeWidth="2"
                    />
                    <circle
                        className="progress-bar"
                        cx={size / 2}
                        cy={size / 2}
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

    if (iconMap[type]) {
        return (
            <div className={`step-indicator ${type}`}>
                <Icon path={iconMap[type]} spin={type === "loading"} />
            </div>
        );
    }

    return (
        <div className={`step-indicator pending`}>
            <span className="step-num">{stepNumber}</span>
        </div>
    );
};

const ScriptOverlay = ({
    scriptName,
    steps,
    failedStep,
    isCompleted,
    currentStep,
    currentProgress,
    getTypeByIndex,
    onCancel,
}) => {
    const { t } = useTranslation();
    const [isExpanded, setIsExpanded] = useState(false);
    const stepsListRef = useRef(null);

    const currentStepIndex = currentStep - 1;
    const currentStepText = steps[currentStepIndex] || steps[steps.length - 1] || "Running...";
    
    const getStatus = () => {
        if (failedStep) return { type: "error", icon: mdiAlertCircle, text: t("scripts.execution.status.error") };
        if (isCompleted) return { type: "success", icon: mdiCheckCircle, text: t("scripts.execution.status.completed") };
        return { type: "running", icon: mdiLoading, text: t("scripts.execution.status.running") };
    };

    const status = getStatus();
    const overallProgress = isCompleted ? 100 : Math.round((currentStepIndex / Math.max(steps.length, 1)) * 100);

    useEffect(() => {
        if (isExpanded && stepsListRef.current) {
            const currentItem = stepsListRef.current.querySelector(".step-item.loading, .step-item.progress");
            if (currentItem) {
                currentItem.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }
    }, [isExpanded, currentStep]);

    return (
        <div className={`script-overlay ${isExpanded ? "expanded" : ""} ${status.type}`}>
            <div className="overlay-progress-bar">
                <div 
                    className="overlay-progress-fill" 
                    style={{ width: `${currentProgress ?? overallProgress}%` }} 
                />
            </div>

            <div className="overlay-main" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="overlay-left">
                    <div className={`status-indicator ${status.type}`}>
                        <Icon path={status.icon} spin={status.type === "running"} />
                    </div>
                    <div className="overlay-info">
                        <span className="script-name">{scriptName}</span>
                        <span className="current-step">{currentStepText}</span>
                    </div>
                </div>

                <div className="overlay-center">
                    <div className="step-dots">
                        {steps.slice(0, 8).map((_, index) => {
                            const type = getTypeByIndex(index);
                            return (
                                <div 
                                    key={index} 
                                    className={`step-dot ${type}`}
                                    title={steps[index]}
                                />
                            );
                        })}
                        {steps.length > 8 && (
                            <span className="more-steps">+{steps.length - 8}</span>
                        )}
                    </div>
                </div>

                <div className="overlay-right">
                    {!isCompleted && !failedStep && (
                        <button 
                            className="overlay-btn cancel-btn" 
                            onClick={(e) => { e.stopPropagation(); onCancel(); }}
                            title={t("common.actions.cancel")}
                        >
                            <Icon path={mdiStop} />
                        </button>
                    )}
                    
                    <div className="expand-indicator">
                        <Icon path={isExpanded ? mdiChevronDown : mdiChevronUp} />
                    </div>
                </div>
            </div>

            <div className="overlay-expanded">
                <div className="steps-header">
                    <span className="steps-title">{t("scripts.execution.progressPanel.steps")}</span>
                    <span className="steps-count">{currentStepIndex + 1} / {steps.length}</span>
                </div>
                <div className="steps-grid" ref={stepsListRef}>
                    {steps.map((step, index) => {
                        const type = getTypeByIndex(index);
                        return (
                            <div key={index} className={`step-item ${type}`}>
                                <StepIndicator type={type} progressValue={currentProgress} stepNumber={index + 1} />
                                <span className="step-text" title={step}>{step}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default ScriptOverlay;
