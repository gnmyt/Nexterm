import LetterAvatar from "@/common/components/LetterAvatar";
import { getAvatarColor, getAvatarIdentifier } from "@/common/utils/avatar.js";
import "./styles.sass";

const MAX_VISIBLE = 3;
const REQUIRED_SPACE = 40;

export const TypingIndicators = ({ anchor, participants }) => {
    if (!anchor || !participants.length) return null;

    const visible = participants.slice(0, MAX_VISIBLE);
    const overflow = participants.length - visible.length;
    const flipped = (anchor.spaceBelow ?? Infinity) < REQUIRED_SPACE;

    return (
        <div className={`typing-indicators${flipped ? " typing-indicators-flipped" : ""}`}
             style={{
                 left: anchor.left + (anchor.width ?? 0) / 2,
                 top: flipped ? anchor.top : anchor.top + anchor.height,
             }}>
            <span className="typing-indicators-pointer"
                  style={{ "--typing-color": getAvatarColor(getAvatarIdentifier(visible[0])) }} />
            <div className="typing-indicators-badges">
                {visible.map(participant => (
                    <div key={participant.viewerId} className="typing-indicators-badge"
                         style={{ "--typing-color": getAvatarColor(getAvatarIdentifier(participant)) }}>
                        <LetterAvatar user={participant} size="sm" />
                    </div>
                ))}
                {overflow > 0 && (
                    <div className="typing-indicators-badge">
                        <LetterAvatar overflow={overflow} size="sm" />
                    </div>
                )}
            </div>
        </div>
    );
};