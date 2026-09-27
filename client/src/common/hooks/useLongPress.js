import { useRef, useCallback, useEffect } from "react";

export const useLongPress = ({ delay = 550, moveTolerance = 12, onLongPress } = {}) => {
    const timerRef = useRef(null);
    const originRef = useRef(null);
    const targetRef = useRef(null);
    const firedRef = useRef(false);
    const handlerRef = useRef(onLongPress);

    useEffect(() => {
        handlerRef.current = onLongPress;
    }, [onLongPress]);

    const clear = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    useEffect(() => clear, [clear]);

    const onTouchStart = useCallback((e) => {
        if (e.touches && e.touches.length !== 1) {
            clear();
            return;
        }
        const touch = e.touches ? e.touches[0] : e;
        firedRef.current = false;
        originRef.current = { x: touch.clientX, y: touch.clientY };
        targetRef.current = e.target;
        clear();
        const x = touch.clientX;
        const y = touch.clientY;
        timerRef.current = setTimeout(() => {
            firedRef.current = true;
            timerRef.current = null;
            try {
                if (navigator.vibrate) navigator.vibrate(15);
            } catch {}
            handlerRef.current?.({ x, y, target: targetRef.current });
        }, delay);
    }, [clear, delay]);

    const onTouchMove = useCallback((e) => {
        if (!timerRef.current || !originRef.current) return;
        const touch = e.touches ? e.touches[0] : e;
        const dx = touch.clientX - originRef.current.x;
        const dy = touch.clientY - originRef.current.y;
        if (Math.hypot(dx, dy) > moveTolerance) clear();
    }, [clear, moveTolerance]);

    const onTouchEnd = useCallback(() => {
        clear();
    }, [clear]);

    const onTouchCancel = useCallback(() => {
        clear();
    }, [clear]);

    const didFire = useCallback(() => firedRef.current, []);

    const reset = useCallback(() => {
        firedRef.current = false;
    }, []);

    return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel, didFire, reset };
};
