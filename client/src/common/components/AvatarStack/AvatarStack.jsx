import LetterAvatar from "@/common/components/LetterAvatar";
import Tooltip from "@/common/components/Tooltip";
import "./styles.sass";

export const AvatarStack = ({ users, max = 2, size = "xs", getKey, title, className = "" }) => {
    if (!users?.length) return null;

    const visible = users.slice(0, max);
    const overflow = users.length - visible.length;

    const stack = (
        <div className={`avatar-stack ${className}`}>
            {visible.map((user, index) => (
                <LetterAvatar key={getKey?.(user) ?? index} user={user} size={size} showTooltip={!title} />
            ))}
            {overflow > 0 && <LetterAvatar overflow={overflow} size={size} />}
        </div>
    );

    return title ? <Tooltip text={title} delay={500} asChild>{stack}</Tooltip> : stack;
};
