import { Component, useState } from "react";
import { useRouteError } from "react-router-dom";
import Icon from "@mdi/react";
import { mdiAlertCircleOutline, mdiRefresh, mdiHome, mdiBug, mdiContentCopy, mdiCheck } from "@mdi/js";
import "./styles.sass";

const ErrorDisplay = ({ error, errorInfo, is404 = false }) => {
    const [copied, setCopied] = useState(false);

    const handleRefresh = () => {
        window.location.reload();
    };

    const handleGoHome = () => {
        window.location.href = "/servers";
    };

    const handleCopyError = () => {
        const errorText = `Error: ${error?.message || "Unknown error"}\n\nStack: ${error?.stack || "No stack trace"}${errorInfo?.componentStack ? `\n\nComponent Stack: ${errorInfo.componentStack}` : ""}`;
        
        navigator.clipboard.writeText(errorText).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const errorMessage = error?.message || error?.statusText || "An unexpected error occurred";

    return (
        <div className="error-boundary">
            <div className="error-boundary-content">
                <div className="error-boundary-icon">
                    <Icon path={mdiAlertCircleOutline} />
                </div>
                
                <h1>{is404 ? "Page Not Found" : "Something went wrong"}</h1>
                <p className="error-boundary-description">
                    {is404 
                        ? "The page you're looking for doesn't exist or has been moved."
                        : "An unexpected error occurred. You can try refreshing the page or return to the home page."
                    }
                </p>
                
                {!is404 && errorMessage && (
                    <div className="error-boundary-details">
                        <div className="error-boundary-message">
                            <Icon path={mdiBug} />
                            <span>{errorMessage}</span>
                        </div>
                    </div>
                )}
                
                <div className="error-boundary-actions">
                    {!is404 && (
                        <button className="error-btn primary" onClick={handleRefresh}>
                            <Icon path={mdiRefresh} />
                            <span>Refresh Page</span>
                        </button>
                    )}
                    <button className={`error-btn ${is404 ? "primary" : "secondary"}`} onClick={handleGoHome}>
                        <Icon path={mdiHome} />
                        <span>Go Home</span>
                    </button>
                    {!is404 && (
                        <button className="error-btn secondary" onClick={handleCopyError}>
                            <Icon path={copied ? mdiCheck : mdiContentCopy} />
                            <span>{copied ? "Copied!" : "Copy Error"}</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { 
            hasError: false, 
            error: null, 
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ errorInfo });
        console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return <ErrorDisplay error={this.state.error} errorInfo={this.state.errorInfo} />;
        }
        return this.props.children;
    }
}

const RouteErrorPage = () => {
    const error = useRouteError();
    const is404 = error?.status === 404;

    return <ErrorDisplay error={error} is404={is404} />;
};

export { ErrorBoundary, RouteErrorPage };
