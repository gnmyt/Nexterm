import "./styles.sass";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faArrowRight, faBook} from "@fortawesome/free-solid-svg-icons";
import {useNavigate} from "react-router-dom";
import {DOCUMENTATION_BASE} from "@/main.jsx";

export const GetStarted = () => {
    const navigate = useNavigate();
    
    return (
        <section className="cta-section">
            <div className="cta-container">
                <div className="cta-glow"/>
                <div className="cta-content">
                    <h2>Ready to get started?</h2>
                    <p>Deploy Nexterm in minutes. Free, open-source, and self-hosted.</p>
                    
                    <div className="cta-actions">
                        <button className="cta-primary" onClick={() => navigate("/install")}>
                            Get Started
                            <FontAwesomeIcon icon={faArrowRight}/>
                        </button>
                        <button className="cta-secondary" onClick={() => window.open(DOCUMENTATION_BASE, "_blank")}>
                            <FontAwesomeIcon icon={faBook}/>
                            Read the Docs
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}