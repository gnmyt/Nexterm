import "./styles.sass";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faShieldHalved, faFolderTree, faUsers, faCode, faScroll, faVideo} from "@fortawesome/free-solid-svg-icons";
import {useRef, useEffect} from "react";

const DOCS_BASE = "https://docs.nexterm.dev";

const features = [
    {
        icon: faShieldHalved,
        title: "Secure Access",
        description: "Two-factor authentication, OIDC SSO, and encrypted credential storage keep your servers protected."
    },
    {
        icon: faFolderTree,
        title: "Organized Structure",
        description: "Organize your servers into folders and use tabs to work on multiple connections simultaneously."
    },
    {
        icon: faUsers,
        title: "Organizations",
        description: "Share server access with your team through organizations with role-based permissions."
    },
    {
        icon: faCode,
        title: "Snippets",
        description: "Save frequently used commands as snippets for quick access across all your servers.",
        link: DOCS_BASE + "/scripts&snippets",
        linkText: "Learn more"
    },
    {
        icon: faScroll,
        title: "Automation Scripts",
        description: "Create and run automation scripts to handle repetitive tasks across your infrastructure.",
        link: DOCS_BASE + "/scripts&snippets",
        linkText: "Learn more"
    },
    {
        icon: faVideo,
        title: "Session Recording",
        description: "Record terminal sessions for auditing, training, or compliance purposes."
    }
];

export const FeatureGrid = () => {
    const gridRef = useRef(null);

    useEffect(() => {
        const grid = gridRef.current;
        if (!grid) return;

        const handleMouseMove = (e) => {
            const cards = grid.querySelectorAll('.feature-card');
            
            cards.forEach(card => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                card.style.setProperty('--mouse-x', `${x}px`);
                card.style.setProperty('--mouse-y', `${y}px`);
            });
        };

        grid.addEventListener('mousemove', handleMouseMove);
        return () => grid.removeEventListener('mousemove', handleMouseMove);
    }, []);

    return (
        <section className="feature-grid-section">
            <div className="section-header">
                <span className="section-label">Features</span>
                <h2>Built for your workflow</h2>
            </div>
            
            <div className="feature-grid" ref={gridRef}>
                {features.map((feature, index) => (
                    <div key={index} className="feature-card">
                        <div className="feature-card-border"/>
                        <div className="feature-card-glow"/>
                        <div className="feature-card-content">
                            <div className="feature-icon">
                                <FontAwesomeIcon icon={feature.icon}/>
                            </div>
                            <h3>{feature.title}</h3>
                            <p>
                                {feature.description}
                                {feature.link && (
                                    <> <a href={feature.link} target="_blank" rel="noopener noreferrer">{feature.linkText} →</a></>
                                )}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    )
}