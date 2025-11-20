import { useContext, useEffect, useState } from "react";
import { mdiPlus, mdiCheck, mdiDotsVertical, mdiPencil, mdiDelete } from "@mdi/js";
import Icon from "@mdi/react";
import { useTranslation } from "react-i18next";
import { getRequest, postRequest, deleteRequest, putRequest, patchRequest } from "@/common/utils/RequestUtil.js";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import "./styles.sass";

const TAG_COLORS = [
    "#ef4444", // red
    "#f97316", // orange
    "#f59e0b", // amber
    "#eab308", // yellow
    "#84cc16", // lime
    "#22c55e", // green
    "#14b8a6", // teal
    "#06b6d4", // cyan
    "#3b82f6", // blue
    "#6366f1", // indigo
    "#8b5cf6", // violet
    "#a855f7", // purple
    "#ec4899", // pink
];

export const TagsSubmenu = ({ entryId, entryTags = [] }) => {
    const { t } = useTranslation();
    const { loadServers } = useContext(ServerContext);
    const [allTags, setAllTags] = useState([]);
    const [showCreateTag, setShowCreateTag] = useState(false);
    const [newTagName, setNewTagName] = useState("");
    const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);
    const [editingTagId, setEditingTagId] = useState(null);
    const [editTagName, setEditTagName] = useState("");
    const [editTagColor, setEditTagColor] = useState("");
    const [showTagMenu, setShowTagMenu] = useState(null);

    useEffect(() => {
        loadTags();
    }, []);

    const loadTags = async () => {
        try {
            const tags = await getRequest("tags/list");
            setAllTags(tags);
        } catch (error) {
            console.error("Failed to load tags:", error);
        }
    };

    const createTag = async () => {
        if (!newTagName.trim()) return;

        try {
            const result = await putRequest("tags", {
                name: newTagName.trim(),
                color: selectedColor,
            });

            await loadTags();
            setNewTagName("");
            setShowCreateTag(false);

            if (result.id) await assignTag(result.id);
        } catch (error) {
            console.error("Failed to create tag:", error);
        }
    };

    const assignTag = async (tagId) => {
        try {
            await postRequest(`tags/${tagId}/assign/${entryId}`);
            await loadServers();
        } catch (error) {
            if (error.message && error.message.includes("already tagged")) {
                await removeTag(tagId);
            } else {
                console.error("Failed to assign tag:", error);
            }
        }
    };

    const removeTag = async (tagId) => {
        try {
            await deleteRequest(`tags/${tagId}/assign/${entryId}`);
            await loadServers();
        } catch (error) {
            console.error("Failed to remove tag:", error);
        }
    };

    const isTagAssigned = (tagId) => {
        return entryTags.some(tag => tag.id === tagId);
    };

    const deleteTag = async (tagId) => {
        try {
            await deleteRequest(`tags/${tagId}`);
            await loadTags();
            await loadServers();
        } catch (error) {
            console.error("Failed to delete tag:", error);
        }
    };

    const startEditTag = (tag, e) => {
        e.stopPropagation();
        setEditingTagId(tag.id);
        setEditTagName(tag.name);
        setEditTagColor(tag.color);
        setShowTagMenu(null);
    };

    const saveEditTag = async (tagId) => {
        if (!editTagName.trim()) return;

        try {
            await patchRequest(`tags/${tagId}`, {
                name: editTagName.trim(),
                color: editTagColor,
            });
            await loadTags();
            await loadServers();
            setEditingTagId(null);
        } catch (error) {
            console.error("Failed to update tag:", error);
        }
    };

    const cancelEdit = () => {
        setEditingTagId(null);
        setEditTagName("");
        setEditTagColor("");
    };

    return (
        <div className="tags-submenu">
            {showCreateTag ? (
                <div className="create-tag-form" onClick={(e) => e.stopPropagation()}>
                    <input
                        type="text"
                        placeholder={t("servers.tags.tagName")}
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                createTag();
                            } else if (e.key === "Escape") {
                                setShowCreateTag(false);
                                setNewTagName("");
                            }
                        }}
                        autoFocus
                    />
                    <div className="color-picker">
                        {TAG_COLORS.map(color => (
                            <div
                                key={color}
                                className={`color-option ${selectedColor === color ? "selected" : ""}`}
                                style={{ backgroundColor: color }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedColor(color);
                                }}
                            />
                        ))}
                    </div>
                    <div className="form-actions">
                        <button onClick={(e) => {
                            e.stopPropagation();
                            createTag();
                        }} disabled={!newTagName.trim()}>
                            {t("servers.tags.create")}
                        </button>
                        <button onClick={(e) => {
                            e.stopPropagation();
                            setShowCreateTag(false);
                            setNewTagName("");
                        }}>
                            {t("common.actions.cancel")}
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="context-item" onClick={(e) => {
                        e.stopPropagation();
                        setShowCreateTag(true);
                    }}>
                        <Icon path={mdiPlus} />
                        <p>{t("servers.tags.createNewTag")}</p>
                    </div>
                    {allTags.length > 0 && <div className="submenu-divider" />}
                    {allTags.map(tag => (
                        editingTagId === tag.id ? (
                            <div key={tag.id} className="create-tag-form" onClick={(e) => e.stopPropagation()}>
                                <input
                                    type="text"
                                    placeholder={t("servers.tags.tagName")}
                                    value={editTagName}
                                    onChange={(e) => setEditTagName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            saveEditTag(tag.id);
                                        } else if (e.key === "Escape") {
                                            cancelEdit();
                                        }
                                    }}
                                    autoFocus
                                />
                                <div className="color-picker">
                                    {TAG_COLORS.map(color => (
                                        <div
                                            key={color}
                                            className={`color-option ${editTagColor === color ? "selected" : ""}`}
                                            style={{ backgroundColor: color }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditTagColor(color);
                                            }}
                                        />
                                    ))}
                                </div>
                                <div className="form-actions">
                                    <button onClick={(e) => {
                                        e.stopPropagation();
                                        saveEditTag(tag.id);
                                    }} disabled={!editTagName.trim()}>
                                        {t("common.actions.confirm")}
                                    </button>
                                    <button onClick={(e) => {
                                        e.stopPropagation();
                                        cancelEdit();
                                    }}>
                                        {t("common.actions.cancel")}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div
                                key={tag.id}
                                className="context-item tag-item"
                            >
                                <div
                                    className="tag-clickable"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        isTagAssigned(tag.id) ? removeTag(tag.id) : assignTag(tag.id);
                                    }}
                                >
                                    <div className="tag-color" style={{ backgroundColor: tag.color }} />
                                    <p>{tag.name}</p>
                                    {isTagAssigned(tag.id) && (
                                        <Icon path={mdiCheck} className="check-icon" />
                                    )}
                                </div>
                                <div
                                    className="tag-menu-button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowTagMenu(showTagMenu === tag.id ? null : tag.id);
                                    }}
                                >
                                    <Icon path={mdiDotsVertical} size={0.7} />
                                </div>
                                {showTagMenu === tag.id && (
                                    <div className="tag-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                                        <div className="dropdown-item" onClick={(e) => startEditTag(tag, e)}>
                                            <Icon path={mdiPencil} size={0.7} />
                                            <span>{t("servers.tags.editTag")}</span>
                                        </div>
                                        <div className="dropdown-item delete" onClick={(e) => {
                                            e.stopPropagation();
                                            deleteTag(tag.id);
                                        }}>
                                            <Icon path={mdiDelete} size={0.7} />
                                            <span>{t("servers.tags.deleteTag")}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    ))}
                </>
            )}
        </div>
    );
};
