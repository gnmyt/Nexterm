import { useEffect, useState } from "react";
import { mdiCheck } from "@mdi/js";
import Icon from "@mdi/react";
import { useTranslation } from "react-i18next";
import { getRequest } from "@/common/utils/RequestUtil.js";
import "./styles.sass";

export const TagFilterMenu = ({ selectedTags, setSelectedTags }) => {
    const { t } = useTranslation();
    const [allTags, setAllTags] = useState([]);

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

    const toggleTag = (tagId) => {
        if (selectedTags.includes(tagId)) {
            setSelectedTags(selectedTags.filter(id => id !== tagId));
        } else {
            setSelectedTags([...selectedTags, tagId]);
        }
    };

    const clearAll = () => {
        setSelectedTags([]);
    };

    return (
        <div className="tag-filter-menu">
            <div className="tag-filter-header">
                <h4>{t("servers.tags.filterByTags")}</h4>
                {selectedTags.length > 0 && (
                    <button className="clear-button" onClick={clearAll}>
                        {t("servers.tags.clearAll")}
                    </button>
                )}
            </div>
            {allTags.length === 0 ? (
                <div className="no-tags">
                    <p>{t("servers.tags.noTagsCreated")}</p>
                </div>
            ) : (
                <div className="tag-list">
                    {allTags.map(tag => (
                        <div
                            key={tag.id}
                            className={`tag-filter-item ${selectedTags.includes(tag.id) ? "selected" : ""}`}
                            onClick={() => toggleTag(tag.id)}
                        >
                            <div className="tag-color" style={{ backgroundColor: tag.color }} />
                            <p>{tag.name}</p>
                            {selectedTags.includes(tag.id) && (
                                <Icon path={mdiCheck} className="check-icon" />
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
