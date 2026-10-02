const reorderSiblings = async (Model, siblings, moved, targetId, placement, movedFields = {}) => {
    const ordered = siblings.filter(item => item.id !== moved.id);

    let index;
    if (targetId === null || targetId === undefined) {
        index = ordered.length;
    } else {
        index = ordered.findIndex(item => item.id === Number.parseInt(targetId));
        if (index === -1) index = ordered.length;
        else if (placement === "after") index += 1;
    }

    ordered.splice(index, 0, moved);

    for (let i = 0; i < ordered.length; i++) {
        const data = ordered[i].id === moved.id ? { position: i, ...movedFields } : { position: i };
        await Model.update(data, { where: { id: ordered[i].id } });
    }
};

module.exports = { reorderSiblings };
