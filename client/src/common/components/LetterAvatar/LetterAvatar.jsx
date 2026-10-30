import { useEffect, useState } from "react";
import {
    getAvatarColor,
    getAvatarIdentifier,
    getAvatarInitials,
    getAvatarLabel,
    getAvatarUrl,
} from "@/common/utils/avatar.js";
import Tooltip from "@/common/components/Tooltip";
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

    const avatar = (
        <div className={`letter-avatar letter-avatar-${size} ${className}`}
             style={{ backgroundColor: showImage ? undefined : getAvatarColor(getAvatarIdentifier(user)) }}>
            {showImage ? <img src={avatarUrl} alt={label || ""} onError={() => setFailed(true)} />
                : <span>{getAvatarInitials(user)}</span>}
        </div>
    );

    return label ? <Tooltip text={label} delay={500} asChild>{avatar}</Tooltip> : avatar;
};
