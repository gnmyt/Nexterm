import "./styles.sass";
import Icon from "@mdi/react";
import { mdiCheck, mdiClose, mdiLoading, mdiSlashForward } from "@mdi/js";

export const InstallStep = ({type, progressValue, text, imgContent}) => {
    const radius = 12;
    const circumference = 2 * Math.PI * radius;
    const progress = circumference - (progressValue / 100) * circumference;

    return (
        <div className="install-step">
            {type === "image" && <div className="indicator image-indicator">
                <img src={imgContent} alt="img" />
            </div>}
            {type === "success" && <div className="indicator success-indicator">
                <Icon path={mdiCheck} />
            </div>}
            {type === "soon" && <div className="indicator soon-indicator"></div>}
            {type === "skip" && <div className="indicator skip-indicator">
                <Icon path={mdiSlashForward} />
            </div>}
            {type === "error" && <div className="indicator error-indicator">
                <Icon path={mdiClose} />
            </div>}
            {type === "loading" && <div className="indicator loading-indicator">
                <Icon path={mdiLoading} spin />
            </div>}
            {type === "progress" && (
                <div className="indicator progress-indicator">
                    <svg width="30" height="30" viewBox="0 0 30 30">
                        <circle className="progress-circle" cx="15" cy="15" r={radius}
                            fill="none" strokeDasharray={circumference} strokeDashoffset={progress} />
                    </svg>
                </div>
            )}
            <h2>{text}</h2>
        </div>
    )
}