import { useCallback, useMemo, useRef, useState } from "react";
import {
    buildGridTree,
    collectLeaves,
    createLeaf,
    findLeafBySession,
    findNodeById,
    removeLeaf,
    replaceLeafSession,
    setBranchSizes,
    splitLeaf,
    swapLeafSessions,
} from "../utils/layoutTree.js";

const EMPTY_STATE = { tree: null, focusedPaneId: null };

const normalizeTree = (tree) => (!tree || tree.type === "leaf") ? null : tree;

const pickFocusedPane = (tree, previousLeaves, previousFocusedId) => {
    const leaves = collectLeaves(tree);
    if (leaves.some(leaf => leaf.id === previousFocusedId)) return previousFocusedId;
    const previousIndex = previousLeaves.findIndex(leaf => leaf.id === previousFocusedId);
    const index = Math.max(0, Math.min(leaves.length - 1, previousIndex));
    return leaves[index]?.id ?? null;
};

export const useSessionLayout = () => {
    const [state, setState] = useState(EMPTY_STATE);
    const stateRef = useRef(EMPTY_STATE);
    const visibleIdsRef = useRef(new Set());
    const pendingPlacementsRef = useRef(new Map());

    const update = useCallback((updater) => {
        const current = stateRef.current;
        const next = updater(current);
        const tree = normalizeTree(next.tree);
        const unchanged = tree === current.tree && next.focusedPaneId === current.focusedPaneId;
        if (unchanged) return current;
        const normalized = tree ? { tree, focusedPaneId: next.focusedPaneId } : EMPTY_STATE;
        stateRef.current = normalized;
        setState(normalized);
        return normalized;
    }, []);

    const splitWithSession = useCallback((targetSessionId, edge, sessionId) => update((current) => {
        if (targetSessionId === sessionId) return current;

        let tree = current.tree ?? createLeaf(targetSessionId);
        const existingLeaf = findLeafBySession(tree, sessionId);
        if (existingLeaf) tree = removeLeaf(tree, existingLeaf.id);
        if (!tree) return current;

        const targetLeaf = findLeafBySession(tree, targetSessionId) ?? findNodeById(tree, current.focusedPaneId) ?? collectLeaves(tree)[0];
        const newLeaf = createLeaf(sessionId);
        return { tree: splitLeaf(tree, targetLeaf.id, edge, newLeaf), focusedPaneId: newLeaf.id };
    }), [update]);

    const showSessionInPane = useCallback((paneId, sessionId) => update((current) => {
        if (!current.tree || !findNodeById(current.tree, paneId)) return current;
        const existingLeaf = findLeafBySession(current.tree, sessionId);
        if (existingLeaf?.id === paneId) return { ...current, focusedPaneId: paneId };
        const tree = existingLeaf
            ? swapLeafSessions(current.tree, existingLeaf.id, paneId)
            : replaceLeafSession(current.tree, paneId, sessionId);
        return { tree, focusedPaneId: paneId };
    }), [update]);

    const showSession = useCallback((sessionId) => update((current) => {
        if (!current.tree) return current;
        const existingLeaf = findLeafBySession(current.tree, sessionId);
        if (existingLeaf) return { ...current, focusedPaneId: existingLeaf.id };
        return { tree: replaceLeafSession(current.tree, current.focusedPaneId, sessionId), focusedPaneId: current.focusedPaneId };
    }), [update]);

    const placeSession = useCallback((sessionId, placement) => {
        if (!placement || placement.edge === "center") return;
        if (visibleIdsRef.current.has(sessionId)) {
            splitWithSession(placement.targetSessionId, placement.edge, sessionId);
            return;
        }
        pendingPlacementsRef.current.set(sessionId, placement);
    }, [splitWithSession]);

    const splitAll = useCallback((sessionIds) => update(() => {
        const tree = buildGridTree(sessionIds);
        return { tree, focusedPaneId: collectLeaves(tree)[0]?.id ?? null };
    }), [update]);

    const clearLayout = useCallback(() => update(() => EMPTY_STATE), [update]);

    const resizeBranch = useCallback((branchId, sizes) => update((current) => ({
        ...current,
        tree: setBranchSizes(current.tree, branchId, sizes),
    })), [update]);

    const reconcile = useCallback(({ visibleIds, activeSessionId, addedIds, removedAny }) => {
        visibleIdsRef.current = visibleIds;

        const placedIds = new Set();
        addedIds.forEach(sessionId => {
            const placement = pendingPlacementsRef.current.get(sessionId);
            if (!placement) return;
            pendingPlacementsRef.current.delete(sessionId);
            splitWithSession(placement.targetSessionId, placement.edge, sessionId);
            placedIds.add(sessionId);
        });

        const result = update((current) => {
            if (!current.tree) return current;

            const previousLeaves = collectLeaves(current.tree);
            let tree = current.tree;
            previousLeaves.forEach(leaf => {
                if (!visibleIds.has(leaf.sessionId)) tree = tree && removeLeaf(tree, leaf.id);
            });
            if (!tree || tree.type === "leaf") return EMPTY_STATE;

            const focusedPaneId = pickFocusedPane(tree, previousLeaves, current.focusedPaneId);
            const activeLeaf = activeSessionId ? findLeafBySession(tree, activeSessionId) : null;
            if (activeLeaf) return { tree, focusedPaneId: activeLeaf.id };

            const activeIsVisible = activeSessionId && visibleIds.has(activeSessionId);
            const activatedExplicitly = activeIsVisible && (addedIds.has(activeSessionId) || !removedAny);
            if (activatedExplicitly && !placedIds.has(activeSessionId)) {
                return { tree: replaceLeafSession(tree, focusedPaneId, activeSessionId), focusedPaneId };
            }
            return { tree, focusedPaneId };
        });

        if (!result.tree || !activeSessionId || !visibleIds.has(activeSessionId)) return activeSessionId;
        return findNodeById(result.tree, result.focusedPaneId)?.sessionId ?? activeSessionId;
    }, [update, splitWithSession]);

    return useMemo(() => ({
        tree: state.tree,
        focusedPaneId: state.focusedPaneId,
        splitWithSession,
        showSessionInPane,
        showSession,
        placeSession,
        splitAll,
        clearLayout,
        resizeBranch,
        reconcile,
    }), [state, splitWithSession, showSessionInPane, showSession, placeSession, splitAll, clearLayout, resizeBranch, reconcile]);
};
