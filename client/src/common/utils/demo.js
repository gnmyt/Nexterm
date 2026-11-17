import { useEffect, useState } from "react";

export const isDemoGuest = (user) => !!user?.demoExpiresAt;

const minutesLeft = (expiresAt) => Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 60000));

export const useDemoCountdown = (expiresAt) => {
    const [minutes, setMinutes] = useState(() => expiresAt ? minutesLeft(expiresAt) : 0);

    useEffect(() => {
        if (!expiresAt) return;

        const update = () => setMinutes(minutesLeft(expiresAt));
        update();
        const timer = setInterval(update, 15000);
        return () => clearInterval(timer);
    }, [expiresAt]);

    return minutes;
};

export const formatDemoTime = (minutes, t) => {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (!hours) return t("common.demo.minutes", { count: Math.max(1, rest) });
    if (!rest) return t("common.demo.hours", { count: hours });
    return t("common.demo.hoursMinutes", { hours, minutes: rest });
};
