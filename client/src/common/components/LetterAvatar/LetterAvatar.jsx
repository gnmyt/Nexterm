import { getAvatarColor, getAvatarIdentifier, getAvatarInitials, getAvatarLabel } from "@/common/utils/avatar.js";
import "./styles.sass";

export const LetterAvatar = ({ user, overflow, size = "md", showTooltip = true, className = "" }) => {
    if (overflow) {
        return (
            <div className={`letter-avatar letter-avatar-${size} letter-avatar-overflow ${className}`}>
                <span>+{overflow}</span>
            </div>
        );
    }

    return (
        <div className={`letter-avatar letter-avatar-${size} ${className}`}
             style={{ backgroundColor: getAvatarColor(getAvatarIdentifier(user)) }}
             title={showTooltip ? getAvatarLabel(user) : undefined}>
            <span>{getAvatarInitials(user)}</span>
        </div>
    );
};
