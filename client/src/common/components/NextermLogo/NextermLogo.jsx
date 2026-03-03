import { memo } from "react";

export const NextermLogo = memo(({ size = 40, className = "" }) => {
    return (
        <svg
            width={size}
            height={size}
            viewBox="-20 -20 570 552"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            style={{ overflow: "visible" }}
        >
            <defs>
                <filter id="glow_nexterm" x="-50%" y="-50%" width="200%" height="200%" filterUnits="objectBoundingBox">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="15" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>
            <path
                d="M323.148 401.419C303.03 401.419 286.72 385.11 286.72 364.992C286.72 344.874 303.03 328.565 323.148 328.565H444.573C464.691 328.565 481 344.874 481 364.992C481 385.11 464.691 401.419 444.573 401.419H323.148ZM141.286 291.862C161.238 271.91 161.197 239.55 141.196 219.648L93.3467 172.037C70.3893 149.193 86.5666 110 118.953 110C128.568 110 137.791 113.815 144.597 120.607L254.421 230.211C268.507 244.539 268.507 267.852 254.421 281.695L145.359 390.757C138.532 397.584 129.272 401.419 119.617 401.419C87.1842 401.419 70.9416 362.206 93.8753 339.273L141.286 291.862Z"
                fill="var(--primary)"
                filter="url(#glow_nexterm)"
            />
        </svg>
    );
});