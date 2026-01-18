import {useEffect, useState} from "react";
import "./styles.sass";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faHome, faArrowLeft} from "@fortawesome/free-solid-svg-icons";
import Button from "@/common/components/Button";

export const NotFound = () => {
    const [countdown, setCountdown] = useState(5);

    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    window.location.href = "/";
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    return (
        <div className="not-found-page">
            <div className="not-found-content">
                <div className="error-code">404</div>
                <h1>Page Not Found</h1>
                <p>The page you're looking for doesn't exist or has been moved.</p>
                <p className="redirect-notice">Redirecting to home in {countdown} seconds...</p>
                
                <div className="not-found-actions">
                    <Button 
                        text="Go Home" 
                        icon={faHome} 
                        color="primary"
                        onClick={() => window.location.href = "/"}
                    />
                    <Button 
                        text="Go Back" 
                        icon={faArrowLeft} 
                        color="primary"
                        variant="outline"
                        onClick={() => window.history.back()}
                    />
                </div>
            </div>
        </div>
    );
}