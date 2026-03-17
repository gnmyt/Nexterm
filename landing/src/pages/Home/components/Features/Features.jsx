import "./styles.sass";
import ConnectionsImage from "@/common/assets/connections.png";
import SftpImage from "@/common/assets/sftp.png";
import MonitoringImage from "@/common/assets/monitoring.png";

export const Features = () => {
    return (
        <section className="features-section">
            <div className="section-header">
                <span className="section-label">How it works</span>
                <h2>Everything you need to manage your servers</h2>
                <p>Connect, monitor, and manage your infrastructure from a single dashboard.</p>
            </div>

            <div className="feature-blocks">
                <div className="feature-block">
                    <div className="feature-content">
                        <span className="feature-number">01</span>
                        <h3>Remote Connections</h3>
                        <p>
                            Connect to your servers via SSH, VNC, or RDP with a modern tabbed interface.
                            Manage multiple sessions simultaneously with ease.
                        </p>
                        <ul className="feature-list">
                            <li>SSH terminal with full color support</li>
                            <li>VNC & RDP for graphical access</li>
                            <li>Tabbed multi-session interface</li>
                        </ul>
                    </div>
                    <div className="feature-image">
                        <img src={ConnectionsImage} alt="Remote connections interface"/>
                    </div>
                </div>

                <div className="feature-block feature-reverse">
                    <div className="feature-content">
                        <span className="feature-number">02</span>
                        <h3>File Management</h3>
                        <p>
                            Browse, upload, download, and edit files on your servers with the built-in
                            SFTP file manager. No external tools needed.
                        </p>
                        <ul className="feature-list">
                            <li>Drag and drop uploads</li>
                            <li>Inline file editing</li>
                            <li>Permission management</li>
                        </ul>
                    </div>
                    <div className="feature-image">
                        <img src={SftpImage} alt="SFTP file manager"/>
                    </div>
                </div>

                <div className="feature-block">
                    <div className="feature-content">
                        <span className="feature-number">03</span>
                        <h3>Real-time Monitoring</h3>
                        <p>
                            Keep an eye on your server health with real-time CPU, memory, disk, 
                            and network metrics at a glance.
                        </p>
                        <ul className="feature-list">
                            <li>Live resource metrics</li>
                            <li>Process monitoring</li>
                            <li>Network statistics</li>
                        </ul>
                    </div>
                    <div className="feature-image">
                        <img src={MonitoringImage} alt="Server monitoring dashboard"/>
                    </div>
                </div>
            </div>
        </section>
    )
}