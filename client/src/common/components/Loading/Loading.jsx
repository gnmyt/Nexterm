import { memo } from "react";
import logo from "@/common/img/logo.avif";
import "./styles.sass";

export const Loading = memo(() => {
    return (
        <div className="loading-container">
            <div className="loading-content">
                <div className="loading-logo-wrapper">
                    <img src={logo} alt="Nexterm" className="loading-logo" />
                    <div className="loading-ring"></div>
                    <div className="loading-ring loading-ring-2"></div>
                    <div className="loading-ring loading-ring-3"></div>
                </div>
            </div>
        </div>
    );
});