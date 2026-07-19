import { useEffect, useState } from "react";
import {
    getAvatarColor,
    getAvatarIdentifier,
    getAvatarInitials,
    getAvatarLabel,
    getAvatarUrl,
} from "@/common/utils/avatar.js";
import "./styles.sass";

export const LetterAvatar = ({ user, overflow, size = "md", showTooltip = true, className = "" }) => {
    const avatarUrl = getAvatarUrl(user);
    const [failed, setFailed] = useState(false);

    useEffect(() => setFailed(false), [avatarUrl]);

    if (overflow) {
        return (
            <div className={`letter-avatar letter-avatar-${size} letter-avatar-overflow ${className}`}>
                <span>+{overflow}</span>
            </div>
        );
    }

    const showImage = avatarUrl && !failed;
    const label = showTooltip ? getAvatarLabel(user) : undefined;

    return (
        <div className={`letter-avatar letter-avatar-${size} ${className}`}
             style={{ backgroundColor: showImage ? undefined : getAvatarColor(getAvatarIdentifier(user)) }}
             title={label}>
            {showImage ? <img src={avatarUrl} alt={label || ""} onError={() => setFailed(true)} />
                : <span>{getAvatarInitials(user)}</span>}
        </div>
    );
};
