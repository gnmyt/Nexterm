import Button from "@/common/components/Button";
import { mdiConsoleLine } from "@mdi/js";
import InstallStep from "@/pages/Apps/components/AppInstaller/components/InstallStep";
import "./styles.sass";
import { useContext, useEffect, useState } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import DebianImage from "./os_images/debian.png";
import LinuxImage from "./os_images/linux.png";

export const AppInstaller = ({ app }) => {

    const { sessionToken } = useContext(UserContext);

    const steps = ["Look up Linux distro", "Check permissions", "Install Docker Engine","Download base image",
        "Run pre-install command",  "Start Docker container", "Run post-install command"];

    const [foundOS, setFoundOS] = useState(null);
    const [osImage, setOSImage] = useState(null);
    const [currentStep, setCurrentStep] = useState(1);
    const [failedStep, setFailedStep] = useState(null);
    const [currentProgress, setCurrentProgress] = useState(null);

    const loadImage = (os) => {
        if (os === "debian") {
            setOSImage(DebianImage);
            return;
        }

        setOSImage(LinuxImage);
    }

    const installApp = () => {
        const protocol = location.protocol === "https:" ? "wss" : "ws";

        const url = process.env.NODE_ENV === "production" ? `${window.location.host}/api/apps/installer` : "localhost:6989/api/apps/installer";
        const ws = new WebSocket(`${protocol}://${url}?sessionToken=${sessionToken}&serverId=1&appId=${app?.id}`);

        ws.onmessage = (event) => {
            const data = event.data.toString();
            const type = data.substring(0, 1);
            const message = data.substring(1);

            if (type === "\x01") {

            } else if (type === "\x02") {
                let step = parseInt(message.split(",")[0]);

                if (step === 1) {
                    let os = message.split(",")[1];
                    let osVersion = message.split(",")[2];
                    loadImage(os.toLowerCase());
                    setFoundOS(`${os} ${osVersion}`);
                }

                if ((step === 4 && !app.preInstallCommand) || (step === 7 && !app.postInstallCommand))
                    step++;

                setCurrentStep(step+1);
            } else if (type === "\x03") {
                setCurrentStep(currentStep => {
                    setFailedStep(currentStep);
                    return currentStep;
                });
            } else if (type === "\x04") {
                setCurrentProgress(parseInt(message));
            }
        }
    };

    const getTypeByIndex = (index) => {
        if (isSkip(index)) return "skip";
        if (index === failedStep - 1) return "error";
        if (failedStep !== null && index > failedStep - 1) return "skip";

        if (index === 0 && foundOS) return "image";

        if (index < currentStep - 1) return "success";

        if (index === 3 && currentProgress !== null) return "progress";

        if (index === currentStep - 1) return "loading";

        return "soon";
    }

    const isSkip = (index) => {
        if (index === 4 && !app.preInstallCommand) return true;
        if (index === 6 && !app.postInstallCommand) return true;
    };

    useEffect(() => {
        setCurrentStep(1);
        setFailedStep(null);
        setCurrentProgress(null);
        setFoundOS(null);

        let timer = setTimeout(() => {
            installApp();
        }, 1000);

        return () => {
            clearTimeout(timer);
        }
    }, [app]);

    return (
        <div className="app-installer">
            <div className="install-header">
                <div className="app-img">
                    <img src={app.icon} alt={app.name} />
                </div>
                <div className="install-info">
                    <h2>{app.name}</h2>
                    <p>Deploying...</p>
                </div>
            </div>

            <div className="install-progress">
                {steps.map((step, index) => {
                    return <InstallStep key={index} progressValue={currentProgress} imgContent={osImage}
                                        type={getTypeByIndex(index)} text={index === 0 && foundOS ? `Detected ${foundOS}` : step} />
                })}
            </div>

            <div className="install-actions">
                <Button text="Logs" icon={mdiConsoleLine} onClick={() => installApp()} />
            </div>
        </div>
    );
};