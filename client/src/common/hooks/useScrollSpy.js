import { useCallback, useEffect, useRef, useState } from "react";

const PIN_DURATION = 700;

export const useScrollSpy = (container, keys, { threshold = 48, offset = 0 } = {}) => {
    const [active, setActive] = useState(keys[0] ?? null);
    const pinnedUntil = useRef(0);
    const signature = keys.join("|");

    useEffect(() => {
        if (!container) return;

        const update = () => {
            if (Date.now() < pinnedUntil.current) return;
            const sections = Array.from(container.querySelectorAll("[data-section]"));
            const containerTop = container.getBoundingClientRect().top;
            let current = sections[0]?.dataset.section ?? null;
            for (const section of sections) {
                if (section.getBoundingClientRect().top - containerTop <= threshold) current = section.dataset.section;
            }
            if (sections.length && container.scrollTop + container.clientHeight >= container.scrollHeight - 2) {
                current = sections[sections.length - 1].dataset.section;
            }
            setActive(prev => prev === current ? prev : current);
        };

        update();
        container.addEventListener("scroll", update, { passive: true });
        return () => container.removeEventListener("scroll", update);
    }, [container, signature, threshold]);

    const scrollTo = useCallback((key) => {
        const target = container?.querySelector(`[data-section="${CSS.escape(key)}"]`);
        if (!target) return null;

        setActive(key);
        pinnedUntil.current = Date.now() + PIN_DURATION;
        const top = target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - offset;
        container.scrollTo({ top, behavior: "smooth" });
        return target;
    }, [container, offset]);

    return [active, scrollTo];
};
