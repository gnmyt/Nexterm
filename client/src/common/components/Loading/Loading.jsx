import { memo } from "react";
import NextermLogo from "@/common/components/NextermLogo";
import "./styles.sass";

export const Loading = memo(() => {
    return (
        <div className="loading-container">
            <div className="loading-content">
                <div className="loading-logo-wrapper">
                    <NextermLogo size={64} className="loading-logo" />
                    <div className="loading-ring"></div>
                    <div className="loading-ring loading-ring-2"></div>
                    <div className="loading-ring loading-ring-3"></div>
                </div>
            </div>
        </div>
    );
});