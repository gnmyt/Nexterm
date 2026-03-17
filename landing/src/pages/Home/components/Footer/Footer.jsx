import {Link} from "react-router-dom";
import "./styles.sass";
import Logo from "@/common/assets/logo.png";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faGithub, faDiscord} from "@fortawesome/free-brands-svg-icons";
import {DOCUMENTATION_BASE, GITHUB_LINK, DISCORD_LINK} from "@/main.jsx";

export const Footer = () => {
    return (
        <footer className="footer">
            <div className="footer-content">
                <div className="footer-brand">
                    <Link to="/" className="footer-logo">
                        <img src={Logo} alt="Nexterm"/>
                        <span>Nexterm</span>
                    </Link>
                    <p>Open-source server management for SSH, VNC & RDP.</p>
                </div>
                
                <div className="footer-links">
                    <div className="footer-column">
                        <h4>Product</h4>
                        <Link to="/install">Install</Link>
                        <a href={DOCUMENTATION_BASE} target="_blank" rel="noopener noreferrer">Documentation</a>
                        <a href={DOCUMENTATION_BASE + "/screenshots"} target="_blank" rel="noopener noreferrer">Screenshots</a>
                    </div>
                    
                    <div className="footer-column">
                        <h4>Legal</h4>
                        <a href="https://gnm.dev/imprint" target="_blank" rel="noopener noreferrer">Imprint</a>
                        <a href="https://gnm.dev/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
                    </div>
                    
                    <div className="footer-column">
                        <h4>Connect</h4>
                        <a href={GITHUB_LINK} target="_blank" rel="noopener noreferrer">
                            <FontAwesomeIcon icon={faGithub}/> GitHub
                        </a>
                        <a href={DISCORD_LINK} target="_blank" rel="noopener noreferrer">
                            <FontAwesomeIcon icon={faDiscord}/> Discord
                        </a>
                    </div>
                </div>
            </div>
            
            <div className="footer-bottom">
                <p>© {new Date().getFullYear()} Mathias Wagner. All rights reserved.</p>
            </div>
        </footer>
    )
}