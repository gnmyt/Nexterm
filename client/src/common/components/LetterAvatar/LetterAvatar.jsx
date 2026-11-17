import { useEffect, useState } from "react";
import {
    getAvatarColor,
    getAvatarIdentifier,
    getAvatarInitials,
    getAvatarLabel,
    getAvatarUrl,
} from "@/common/utils/avatar.js";
import Tooltip from "@/common/components/Tooltip";
import Icon from "@mdi/react";
import { mdiCreationOutline, mdiRobotOutline } from "@mdi/js";
import { useTranslation } from "react-i18next";
import "./styles.sass";

const AgentAvatar = ({ user, size, showTooltip, className }) => {
    const { t } = useTranslation();
    const isAi = user.origin === "ai";
    const label = showTooltip
        ? t(isAi ? "servers.automatedSession.viewOnlyAi" : "servers.automatedSession.viewOnlyMcp")
        : undefined;
    const avatar = (
        <div className={`letter-avatar letter-avatar-${size} letter-avatar-agent ${className}`}>
            <Icon path={isAi ? mdiCreationOutline : mdiRobotOutline} />
        </div>
    );
    return label ? <Tooltip text={label} delay={500} asChild>{avatar}</Tooltip> : avatar;
};

export const LetterAvatar = ({ user, overflow, size = "md", showTooltip = true, className = "" }) => {
    const avatarUrl = getAvatarUrl(user);
    const [failed, setFailed] = useState(false);

    useEffect(() => setFailed(false), [avatarUrl]);

    if (user?.kind === "agent") return <AgentAvatar user={user} size={size} showTooltip={showTooltip} className={className} />;

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
             style={showImage ? undefined : { "--avatar-color": getAvatarColor(getAvatarIdentifier(user)) }}>
            {showImage ? <img src={avatarUrl} alt={label || ""} onError={() => setFailed(true)} />
                : <span>{getAvatarInitials(user)}</span>}
        </div>
    );

    return label ? <Tooltip text={label} delay={500} asChild>{avatar}</Tooltip> : avatar;
};
