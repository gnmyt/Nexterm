import "./styles.sass";
import {faDocker} from "@fortawesome/free-brands-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCheck, faCopy, faRefresh, faServer, faGears, faCubes, faTerminal, faFileCode, faDatabase, faFolder, faNetworkWired, faBridge} from "@fortawesome/free-solid-svg-icons";
import {useState, useEffect} from "react";
import {DOCUMENTATION_BASE} from "@/main.jsx";
import Footer from "@/pages/Home/components/Footer";

const generateEncryptionKey = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

const IMAGE_TYPES = [
    {id: 'aio', name: 'All-in-One', image: 'nexterm/aio', desc: 'Server and engine bundled together', recommended: true, icon: faCubes},
    {id: 'server', name: 'Server', image: 'nexterm/server', desc: 'Web UI and API only', icon: faServer},
    {id: 'engine', name: 'Engine', image: 'nexterm/engine', desc: 'Connection engine only', icon: faGears},
];

export const Install = () => {
    const [imageType, setImageType] = useState('aio');
    const [deployMethod, setDeployMethod] = useState('docker');
    const [networkMode, setNetworkMode] = useState('host');
    const [volumeType, setVolumeType] = useState('named');
    const [volumeName, setVolumeName] = useState('nexterm');
    const [bindPath, setBindPath] = useState('./nexterm-data');
    const [encryptionKey, setEncryptionKey] = useState('');
    const [copied, setCopied] = useState(false);
    const [copiedConfig, setCopiedConfig] = useState(false);
    const [engineHost, setEngineHost] = useState('127.0.0.1');
    const [enginePort, setEnginePort] = useState('7800');

    useEffect(() => {
        setEncryptionKey(generateEncryptionKey());
    }, []);

    const copyToClipboard = (text, setter = setCopied) => {
        navigator.clipboard.writeText(text);
        setter(true);
        setTimeout(() => setter(false), 2000);
    };

    const selectedImage = IMAGE_TYPES.find(t => t.id === imageType);
    const needsStorage = imageType !== 'engine';
    const volumeArg = volumeType === 'named' ? `${volumeName}:/app/data` : `${bindPath}:/app/data`;

    const getEngineConfig = () => {
        return `server_host: "${engineHost}"
server_port: ${enginePort}
registration_token: ""`;
    };

    const getDockerCommand = () => {
        if (imageType === 'engine') {
            return `docker run -d \\
  --name nexterm-engine \\
  --restart always \\
  -v ./config.yaml:/etc/nexterm/config.yaml \\
  ${selectedImage.image}:latest`;
        }

        const networkArg = networkMode === 'host' ? '--network host' : '-p 6989:6989';

        return `docker run -d \\
  -e ENCRYPTION_KEY=${encryptionKey} \\
  ${networkArg} \\
  --name nexterm \\
  --restart always \\
  -v ${volumeArg} \\
  ${selectedImage.image}:latest`;
    };

    const getDockerComposeContent = () => {
        if (imageType === 'engine') {
            return `services:
  engine:
    image: ${selectedImage.image}:latest
    container_name: nexterm-engine
    restart: always
    volumes:
      - ./config.yaml:/etc/nexterm/config.yaml`;
        }

        const volLine = `      - ${volumeArg}`;
        const volSection = volumeType === 'named' ? `\nvolumes:\n  ${volumeName}:` : '';

        const networkYaml = networkMode === 'host'
            ? '    network_mode: host'
            : '    ports:\n      - "6989:6989"';

        return `services:
  nexterm:
    image: ${selectedImage.image}:latest
    container_name: nexterm
${networkYaml}
    restart: always
    environment:
      - ENCRYPTION_KEY=${encryptionKey}
    volumes:
${volLine}${volSection}`;
    };

    const output = deployMethod === 'docker' ? getDockerCommand() : getDockerComposeContent();

    return (
        <div className="install-page">
            <div className="install-container">
                <header className="install-header">
                    <h1>Install Nexterm</h1>
                    <p>Deploy in minutes with Docker</p>
                </header>

                <div className="install-step">
                    <div className="step-header">
                        <span className="step-number">1</span>
                        <div>
                            <h3>Install Docker</h3>
                            <p>Skip this step if Docker is already installed</p>
                        </div>
                    </div>
                    <div className="command-block">
                        <div className="command-header">
                            <span>Terminal</span>
                        </div>
                        <pre><code>curl -sSL https://get.docker.com | sh</code></pre>
                    </div>
                </div>

                <div className="install-step">
                    <div className="step-header">
                        <span className="step-number">2</span>
                        <div>
                            <h3>Create Project Directory</h3>
                            <p>Create a directory for your Nexterm configuration</p>
                        </div>
                    </div>
                    <div className="command-block">
                        <div className="command-header">
                            <span>Terminal</span>
                        </div>
                        <pre><code>mkdir nexterm && cd nexterm</code></pre>
                    </div>
                </div>

                <div className="install-step">
                    <div className="step-header">
                        <span className="step-number">3</span>
                        <div>
                            <h3>Choose Image</h3>
                            <p>Select the deployment type that fits your setup</p>
                        </div>
                    </div>

                    <div className="type-list">
                        {IMAGE_TYPES.map(type => (
                            <button
                                key={type.id}
                                className={`type-row ${imageType === type.id ? 'selected' : ''}`}
                                onClick={() => setImageType(type.id)}
                            >
                                <FontAwesomeIcon icon={type.icon} className="type-icon"/>
                                <span className="type-name">{type.name}</span>
                                <span className="type-desc">{type.desc}</span>
                                {type.recommended && <span className="type-badge">Recommended</span>}
                            </button>
                        ))}
                    </div>

                    <div className="options-list">
                        <div className="option-row">
                            <span className="option-label">Method</span>
                            <div className="option-switcher">
                                <button className={deployMethod === 'docker' ? 'active' : ''} onClick={() => setDeployMethod('docker')}><FontAwesomeIcon icon={faTerminal}/> Docker CLI</button>
                                <button className={deployMethod === 'compose' ? 'active' : ''} onClick={() => setDeployMethod('compose')}><FontAwesomeIcon icon={faFileCode}/> Compose</button>
                            </div>
                        </div>

                        {needsStorage && (
                            <div className="option-row">
                                <span className="option-label">Network</span>
                                <div className="option-switcher">
                                    <button className={networkMode === 'host' ? 'active' : ''} onClick={() => setNetworkMode('host')}><FontAwesomeIcon icon={faNetworkWired}/> Host</button>
                                    <button className={networkMode === 'bridge' ? 'active' : ''} onClick={() => setNetworkMode('bridge')}><FontAwesomeIcon icon={faBridge}/> Bridge</button>
                                </div>
                            </div>
                        )}

                        {needsStorage && (
                            <>
                                <div className="option-row">
                                    <span className="option-label">Storage</span>
                                    <div className="option-switcher">
                                    <button className={volumeType === 'named' ? 'active' : ''} onClick={() => setVolumeType('named')}><FontAwesomeIcon icon={faDatabase}/> Named Volume</button>
                                    <button className={volumeType === 'bind' ? 'active' : ''} onClick={() => setVolumeType('bind')}><FontAwesomeIcon icon={faFolder}/> Bind Mount</button>
                                    </div>
                                </div>
                                <div className="option-row">
                                    <span className="option-label">{volumeType === 'named' ? 'Volume' : 'Path'}</span>
                                    <input
                                        type="text"
                                        value={volumeType === 'named' ? volumeName : bindPath}
                                        onChange={(e) => volumeType === 'named' ? setVolumeName(e.target.value) : setBindPath(e.target.value)}
                                        placeholder={volumeType === 'named' ? 'nexterm' : './nexterm-data'}
                                    />
                                </div>
                            </>
                        )}

                        {imageType === 'engine' && (
                            <>
                                <div className="option-row">
                                    <span className="option-label">Host</span>
                                    <input type="text" value={engineHost} onChange={(e) => setEngineHost(e.target.value)} placeholder="server"/>
                                </div>
                                <div className="option-row">
                                    <span className="option-label">Port</span>
                                    <input type="text" value={enginePort} onChange={(e) => setEnginePort(e.target.value)} placeholder="7800"/>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="install-step">
                    <div className="step-header">
                        <span className="step-number">4</span>
                        <div>
                            <h3>Deploy</h3>
                            <p>Run the command to start your Nexterm instance</p>
                        </div>
                    </div>

                    <div className="command-block" onClick={() => copyToClipboard(output)}>
                        <div className="command-header">
                            <FontAwesomeIcon icon={faDocker}/>
                            <span>{deployMethod === 'docker' ? 'Terminal' : 'docker-compose.yml'}</span>
                            <button className={`copy-btn ${copied ? 'copied' : ''}`}>
                                <FontAwesomeIcon icon={copied ? faCheck : faCopy}/>
                                {copied ? 'Copied!' : 'Copy'}
                            </button>
                        </div>
                        <pre><code>{output}</code></pre>
                    </div>

                    {imageType === 'engine' && (
                        <div className="command-block" onClick={() => copyToClipboard(getEngineConfig(), setCopiedConfig)}>
                            <div className="command-header">
                                <span>config.yaml</span>
                                <button className={`copy-btn ${copiedConfig ? 'copied' : ''}`}>
                                    <FontAwesomeIcon icon={copiedConfig ? faCheck : faCopy}/>
                                    {copiedConfig ? 'Copied!' : 'Copy'}
                                </button>
                            </div>
                            <pre><code>{getEngineConfig()}</code></pre>
                        </div>
                    )}

                    {needsStorage && (
                        <div className="info-bar">
                            <span>Encryption Key</span>
                            <span className="info-hint">Save securely for data migration</span>
                            <button className="regen-btn" onClick={() => setEncryptionKey(generateEncryptionKey())}>
                                <FontAwesomeIcon icon={faRefresh}/> Regenerate
                            </button>
                        </div>
                    )}
                </div>

                <div className="install-step">
                    <div className="step-header">
                        <span className="step-number">5</span>
                        <div>
                            <h3>Access Nexterm</h3>
                            <p>{needsStorage
                                ? 'Open the web interface in your browser'
                                : 'The engine will connect to your Nexterm server'
                            }</p>
                        </div>
                    </div>

                    {needsStorage ? (
                        <div className="info-bar">
                            <span>Open in browser</span>
                            <code>http://localhost:6989</code>
                        </div>
                    ) : (
                        <div className="info-bar">
                            <span>Save config.yaml next to docker-compose.yml or mount it with -v</span>
                        </div>
                    )}
                </div>

                <div className="help-links">
                    <a href={DOCUMENTATION_BASE + "/reverse-proxy"} target="_blank" rel="noopener noreferrer">Reverse Proxy</a>
                    <a href={DOCUMENTATION_BASE + "/ssl"} target="_blank" rel="noopener noreferrer">SSL Setup</a>
                    <a href={DOCUMENTATION_BASE + "/"} target="_blank" rel="noopener noreferrer">Full Documentation</a>
                </div>
            </div>
            <Footer/>
        </div>
    );
}
