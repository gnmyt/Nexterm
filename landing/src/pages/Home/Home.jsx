import "./styles.sass";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faArrowRight} from "@fortawesome/free-solid-svg-icons";
import {faGithub} from "@fortawesome/free-brands-svg-icons";
import Features from "@/pages/Home/components/Features";
import FeatureGrid from "@/pages/Home/components/FeatureGrid";
import GetStarted from "@/pages/Home/components/GetStarted";
import Footer from "@/pages/Home/components/Footer";
import {useNavigate} from "react-router-dom";
import {useEffect, useRef} from "react";
import {GITHUB_LINK} from "@/main.jsx";

import ConnectionsImage from "@/common/assets/connections.png";

export const Home = () => {
    const navigate = useNavigate();
    const imageRef = useRef(null);

    useEffect(() => {
        const handleScroll = () => {
            if (!imageRef.current) return;

            const scrollY = window.scrollY;
            const windowHeight = window.innerHeight;
            const progress = Math.min(scrollY / (windowHeight * 0.5), 1);

            const rotateX = 12 - (progress * 12);
            const scale = 0.92 + (progress * 0.08);
            const translateY = progress * -30;
            const opacity = 1 - (progress * 0.15);

            imageRef.current.style.transform = `perspective(1200px) rotateX(${rotateX}deg) scale(${scale}) translateY(${translateY}px)`;
            imageRef.current.style.opacity = opacity;
        };

        window.addEventListener('scroll', handleScroll, {passive: true});
        handleScroll();

        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="home-page">
            <section className="hero">
                <div className="hero-content">
                    <h1>
                        Server Management<br/>
                        <span className="highlight">
                            Made Simple
                            <svg className="underline-sketch" viewBox="0 0 200 16" preserveAspectRatio="none">
                                <path d="M2 10 C 15 6, 25 12, 50 8 C 75 4, 85 13, 110 9 C 135 5, 150 12, 175 7 C 190 4, 195 10, 198 8" 
                                      fill="none" 
                                      strokeWidth="2.5" 
                                      strokeLinecap="round"/>
                            </svg>
                        </span>
                    </h1>
                    <p className="hero-description">
                        Connect to your servers via SSH, VNC & RDP. Manage files, deploy containers,
                        and monitor your infrastructure - all from one place.
                    </p>

                    <div className="hero-actions">
                        <button className="btn-primary" onClick={() => navigate("/install")}>
                            Get Started
                            <FontAwesomeIcon icon={faArrowRight}/>
                        </button>
                        <button className="btn-secondary" onClick={() => window.open(GITHUB_LINK, "_blank")}>
                            <FontAwesomeIcon icon={faGithub}/>
                            View on GitHub
                        </button>
                    </div>
                </div>

                <div className="hero-visual">
                    <img ref={imageRef} src={ConnectionsImage} alt="Nexterm Interface" draggable={false}/>
                </div>
            </section>

            <Features/>
            <FeatureGrid/>
            <GetStarted/>
            <Footer/>
        </div>
    )
}