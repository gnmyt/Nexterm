import LetterAvatar from "@/common/components/LetterAvatar";
import "./styles.sass";

export const AvatarStack = ({ users, max = 2, size = "xs", getKey, title, className = "" }) => {
    if (!users?.length) return null;

    const visible = users.slice(0, max);
    const overflow = users.length - visible.length;

    return (
        <div className={`avatar-stack ${className}`} title={title}>
            {visible.map((user, index) => (
                <LetterAvatar key={getKey?.(user) ?? index} user={user} size={size} showTooltip={!title} />
            ))}
            {overflow > 0 && <LetterAvatar overflow={overflow} size={size} />}
        </div>
    );
};
