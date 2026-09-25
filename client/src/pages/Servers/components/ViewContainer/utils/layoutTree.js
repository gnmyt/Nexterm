let nextNodeId = 1;
const createNodeId = () => `pane-${nextNodeId++}`;

export const EDGES = ["left", "right", "top", "bottom", "center"];

const edgeOrientation = (edge) => (edge === "left" || edge === "right") ? "horizontal" : "vertical";
const edgeInsertsBefore = (edge) => edge === "left" || edge === "top";

export const createLeaf = (sessionId) => ({ type: "leaf", id: createNodeId(), sessionId });

export const createBranch = (orientation, children, sizes) => ({ type: "branch", id: createNodeId(), orientation, children, sizes });

const normalizeSizes = (sizes) => {
    const total = sizes.reduce((sum, size) => sum + size, 0);
    if (total <= 0) return sizes.map(() => 1 / sizes.length);
    return sizes.map(size => size / total);
};

export const collectLeaves = (node, result = []) => {
    if (!node) return result;
    if (node.type === "leaf") {
        result.push(node);
        return result;
    }
    node.children.forEach(child => collectLeaves(child, result));
    return result;
};

export const findLeafBySession = (node, sessionId) => collectLeaves(node).find(leaf => leaf.sessionId === sessionId) || null;

export const findNodeById = (node, id) => {
    if (!node) return null;
    if (node.id === id) return node;
    if (node.type === "leaf") return null;
    for (const child of node.children) {
        const found = findNodeById(child, id);
        if (found) return found;
    }
    return null;
};

const mapLeaves = (node, mapper) => {
    if (node.type === "leaf") return mapper(node);
    return { ...node, children: node.children.map(child => mapLeaves(child, mapper)) };
};

export const replaceLeafSession = (root, leafId, sessionId) =>
    mapLeaves(root, leaf => leaf.id === leafId ? { ...leaf, sessionId } : leaf);

export const swapLeafSessions = (root, firstLeafId, secondLeafId) => {
    const first = findNodeById(root, firstLeafId);
    const second = findNodeById(root, secondLeafId);
    return mapLeaves(root, leaf => {
        if (leaf.id === firstLeafId) return { ...leaf, sessionId: second.sessionId };
        if (leaf.id === secondLeafId) return { ...leaf, sessionId: first.sessionId };
        return leaf;
    });
};

export const splitLeaf = (root, leafId, edge, newLeaf) => {
    const orientation = edgeOrientation(edge);
    const before = edgeInsertsBefore(edge);

    const wrap = (leaf) => createBranch(orientation, before ? [newLeaf, leaf] : [leaf, newLeaf], [0.5, 0.5]);

    const insert = (node) => {
        if (node.type === "leaf") return node.id === leafId ? wrap(node) : node;

        const index = node.children.findIndex(child => child.id === leafId);
        if (index !== -1 && node.orientation === orientation) {
            const children = [...node.children];
            const sizes = [...node.sizes];
            const half = sizes[index] / 2;
            sizes[index] = half;
            const insertAt = before ? index : index + 1;
            children.splice(insertAt, 0, newLeaf);
            sizes.splice(insertAt, 0, half);
            return { ...node, children, sizes };
        }

        return { ...node, children: node.children.map(insert) };
    };

    return insert(root);
};

const flattenBranch = (node) => {
    const children = [];
    const sizes = [];
    node.children.forEach((child, index) => {
        if (child.type === "branch" && child.orientation === node.orientation) {
            child.children.forEach((grandChild, grandIndex) => {
                children.push(grandChild);
                sizes.push(node.sizes[index] * child.sizes[grandIndex]);
            });
        } else {
            children.push(child);
            sizes.push(node.sizes[index]);
        }
    });
    return { ...node, children, sizes: normalizeSizes(sizes) };
};

export const removeLeaf = (root, leafId) => {
    const remove = (node) => {
        if (node.type === "leaf") return node.id === leafId ? null : node;

        const index = node.children.findIndex(child => child.id === leafId);
        if (index !== -1) {
            const children = node.children.filter((_, childIndex) => childIndex !== index);
            const sizes = node.sizes.filter((_, childIndex) => childIndex !== index);
            if (children.length === 1) return children[0];
            return { ...node, children, sizes: normalizeSizes(sizes) };
        }

        return flattenBranch({ ...node, children: node.children.map(remove) });
    };

    return remove(root);
};

export const setBranchSizes = (root, branchId, sizes) => {
    const update = (node) => {
        if (node.type === "leaf") return node;
        if (node.id === branchId) return { ...node, sizes };
        return { ...node, children: node.children.map(update) };
    };
    return update(root);
};

const gridDimensions = (count) => {
    const presets = { 2: [1, 2], 3: [2, 2], 4: [2, 2], 5: [3, 2], 6: [2, 3] };
    const columns = presets[count]?.[1] ?? Math.ceil(Math.sqrt(count));
    return columns;
};

export const buildGridTree = (sessionIds) => {
    if (sessionIds.length === 0) return null;
    if (sessionIds.length === 1) return createLeaf(sessionIds[0]);

    const columns = gridDimensions(sessionIds.length);
    const rows = [];
    for (let start = 0; start < sessionIds.length; start += columns) {
        const rowSessions = sessionIds.slice(start, start + columns);
        const leaves = rowSessions.map(createLeaf);
        rows.push(leaves.length === 1 ? leaves[0] : createBranch("horizontal", leaves, leaves.map(() => 1 / leaves.length)));
    }

    return rows.length === 1 ? rows[0] : createBranch("vertical", rows, rows.map(() => 1 / rows.length));
};

export const computeGeometry = (node, rect, gap, geometry = { leaves: new Map(), branches: new Map(), sashes: [] }) => {
    if (node.type === "leaf") {
        geometry.leaves.set(node.id, rect);
        return geometry;
    }

    geometry.branches.set(node.id, rect);

    const horizontal = node.orientation === "horizontal";
    const available = Math.max(0, (horizontal ? rect.width : rect.height) - gap * (node.children.length - 1));
    let offset = horizontal ? rect.x : rect.y;

    node.children.forEach((child, index) => {
        const size = available * node.sizes[index];
        const childRect = horizontal
            ? { x: offset, y: rect.y, width: size, height: rect.height }
            : { x: rect.x, y: offset, width: rect.width, height: size };
        computeGeometry(child, childRect, gap, geometry);
        offset += size;

        if (index < node.children.length - 1) {
            geometry.sashes.push({
                id: `${node.id}-${index}`,
                branchId: node.id,
                index,
                orientation: node.orientation,
                rect: horizontal
                    ? { x: offset, y: rect.y, width: gap, height: rect.height }
                    : { x: rect.x, y: offset, width: rect.width, height: gap },
            });
            offset += gap;
        }
    });

    return geometry;
};
