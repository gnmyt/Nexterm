import "./styles.sass";
import {faDocker} from "@fortawesome/free-brands-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCheck, faCopy, faChevronRight, faChevronLeft, faRefresh, faLayerGroup, faTerminal, faHardDrive, faFolderOpen} from "@fortawesome/free-solid-svg-icons";
import {useState, useEffect} from "react";
import {DOCUMENTATION_BASE} from "@/main.jsx";

const generateEncryptionKey = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

export const Install = () => {
    const [step, setStep] = useState(1);
    const [encryptionKey, setEncryptionKey] = useState('');
    const [deployMethod, setDeployMethod] = useState('docker');
    const [volumeType, setVolumeType] = useState('named');
    const [volumeName, setVolumeName] = useState('nexterm');
    const [bindPath, setBindPath] = useState('./nexterm-data');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        setEncryptionKey(generateEncryptionKey());
    }, []);

    const regenerateKey = () => {
        setEncryptionKey(generateEncryptionKey());
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getDockerCommand = () => {
        const volumeArg = volumeType === 'named' 
            ? `-v ${volumeName}:/app/data`
            : `-v ${bindPath}:/app/data`;
        
        return `docker run -d \\
  -e ENCRYPTION_KEY=${encryptionKey} \\
  --network host \\
  --name nexterm \\
  --restart always \\
  ${volumeArg} \\
  germannewsmaker/nexterm:latest`;
    };

    const getDockerComposeContent = () => {
        const volumeConfig = volumeType === 'named'
            ? `      - ${volumeName}:/app/data`
            : `      - ${bindPath}:/app/data`;
        
        const volumesSection = volumeType === 'named'
            ? `\nvolumes:\n  ${volumeName}:`
            : '';

        return `services:
  nexterm:
    image: germannewsmaker/nexterm:latest
    container_name: nexterm
    network_mode: host
    restart: always
    environment:
      - ENCRYPTION_KEY=${encryptionKey}
    volumes:
${volumeConfig}${volumesSection}`;
    };

    const openDocs = (path) => window.open(DOCUMENTATION_BASE + path, "_blank");

    return (
        <div className="install-page">
            <div className="install-container">
                <div className="install-header">
                    <h1>Install Nexterm</h1>
                    <p>Configure your deployment in a few simple steps</p>
                </div>

                <div className="wizard-progress">
                    <div className={`progress-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
                        <span className="step-dot">1</span>
                        <span className="step-label">Method</span>
                    </div>
                    <div className="progress-line"/>
                    <div className={`progress-step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
                        <span className="step-dot">2</span>
                        <span className="step-label">Storage</span>
                    </div>
                    <div className="progress-line"/>
                    <div className={`progress-step ${step >= 3 ? 'active' : ''}`}>
                        <span className="step-dot">3</span>
                        <span className="step-label">Deploy</span>
                    </div>
                </div>

                <div className="wizard-content">
                    {step === 1 && (
                        <div className="wizard-step">
                            <h2>Deployment Method</h2>
                            <p>Choose how you want to deploy Nexterm.</p>
                            
                            <div className="option-cards">
                                <button 
                                    className={`option-card ${deployMethod === 'docker' ? 'selected' : ''}`}
                                    onClick={() => setDeployMethod('docker')}
                                >
                                    <FontAwesomeIcon icon={faTerminal}/>
                                    <span className="option-title">Docker CLI</span>
                                    <span className="option-desc">Single command deployment</span>
                                </button>
                                <button 
                                    className={`option-card ${deployMethod === 'compose' ? 'selected' : ''}`}
                                    onClick={() => setDeployMethod('compose')}
                                >
                                    <FontAwesomeIcon icon={faLayerGroup}/>
                                    <span className="option-title">Docker Compose</span>
                                    <span className="option-desc">YAML configuration file</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="wizard-step">
                            <h2>Storage Configuration</h2>
                            <p>Choose how to persist your Nexterm data.</p>
                            
                            <div className="option-cards">
                                <button 
                                    className={`option-card ${volumeType === 'named' ? 'selected' : ''}`}
                                    onClick={() => setVolumeType('named')}
                                >
                                    <FontAwesomeIcon icon={faHardDrive}/>
                                    <span className="option-title">Named Volume</span>
                                    <span className="option-desc">Docker-managed storage</span>
                                </button>
                                <button 
                                    className={`option-card ${volumeType === 'bind' ? 'selected' : ''}`}
                                    onClick={() => setVolumeType('bind')}
                                >
                                    <FontAwesomeIcon icon={faFolderOpen}/>
                                    <span className="option-title">Bind Mount</span>
                                    <span className="option-desc">Map to host directory</span>
                                </button>
                            </div>

                            <div className="input-group">
                                <label>{volumeType === 'named' ? 'Volume Name' : 'Host Path'}</label>
                                <input 
                                    type="text" 
                                    value={volumeType === 'named' ? volumeName : bindPath}
                                    onChange={(e) => volumeType === 'named' 
                                        ? setVolumeName(e.target.value) 
                                        : setBindPath(e.target.value)
                                    }
                                    placeholder={volumeType === 'named' ? 'nexterm' : './nexterm-data'}
                                />
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="wizard-step">
                            <h2>Deploy Nexterm</h2>
                            <p>
                                {deployMethod === 'docker' 
                                    ? 'Run this command in your terminal:' 
                                    : 'Save this as docker-compose.yml and run docker compose up -d:'}
                            </p>
                            
                            <div className="command-block" onClick={() => copyToClipboard(deployMethod === 'docker' ? getDockerCommand() : getDockerComposeContent())}>
                                <div className="command-header">
                                    <FontAwesomeIcon icon={faDocker}/>
                                    <span>{deployMethod === 'docker' ? 'Terminal' : 'docker-compose.yml'}</span>
                                    <button className={`copy-btn ${copied ? 'copied' : ''}`}>
                                        <FontAwesomeIcon icon={copied ? faCheck : faCopy}/>
                                        {copied ? 'Copied!' : 'Copy'}
                                    </button>
                                </div>
                                <pre><code>{deployMethod === 'docker' ? getDockerCommand() : getDockerComposeContent()}</code></pre>
                            </div>

                            <div className="key-section">
                                <div className="key-header">
                                    <span>Encryption Key</span>
                                    <button className="regen-btn" onClick={regenerateKey}>
                                        <FontAwesomeIcon icon={faRefresh}/>
                                        Regenerate
                                    </button>
                                </div>
                                <p className="key-hint">Save this key securely - you'll need it if you migrate your data.</p>
                            </div>

                            <div className="access-info">
                                <span className="access-label">After deployment, access Nexterm at</span>
                                <div className="access-url">
                                    <code>http://localhost:6989</code>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="wizard-actions">
                    {step > 1 && (
                        <button className="btn-back" onClick={() => setStep(step - 1)}>
                            <FontAwesomeIcon icon={faChevronLeft}/>
                            Back
                        </button>
                    )}
                    {step < 3 && (
                        <button className="btn-next" onClick={() => setStep(step + 1)}>
                            Next
                            <FontAwesomeIcon icon={faChevronRight}/>
                        </button>
                    )}
                </div>

                <div className="help-section">
                    <p>Need more options?</p>
                    <div className="help-links">
                        <a onClick={() => openDocs("/reverse-proxy")}>Reverse Proxy</a>
                        <a onClick={() => openDocs("/ssl")}>SSL Setup</a>
                        <a onClick={() => openDocs("/")}>Full Documentation</a>
                    </div>
                </div>
            </div>
        </div>
    );
}
