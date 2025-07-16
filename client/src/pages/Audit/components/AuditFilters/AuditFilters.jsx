import { useState, useMemo, useCallback } from "react";
import Icon from "@mdi/react";
import { mdiFilterVariantPlus, mdiFilterVariantMinus } from "@mdi/js";
import SelectBox from "@/common/components/SelectBox";
import Button from "@/common/components/Button";
import { useTranslation } from "react-i18next";
import "./styles.sass";

export const AuditFilters = ({ filters, metadata, organizations, onChange }) => {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);

    const handleFilterChange = useCallback((key, value) => {
        onChange({ [key]: value });
    }, [onChange]);

    const clearFilters = useCallback(() => {
        onChange({ organizationId: null, action: "", resource: "", startDate: "", endDate: "" });
    }, [onChange]);

    const actionOptions = useMemo(() => {
        if (!metadata?.actionCategories) return [];

        const options = [{ value: "", label: t('audit.filters.options.allActions') }];

        metadata.actionCategories.forEach(category => {
            options.push({
                value: `${category.key}.*`,
                label: t('audit.filters.options.categoryAll', { category: category.label }),
                isCategory: true,
            });
        });

        metadata?.actions?.forEach(action => {
            options.push({
                value: action.value,
                label: action.value.replace(".", " → ").replace("_", " "),
            });
        });

        return options;
    }, [metadata, t]);

    const resourceOptions = useMemo(() => {
        if (!metadata?.resources) return [{ value: "", label: t('audit.filters.options.allResources') }];

        return [
            { value: "", label: t('audit.filters.options.allResources') },
            ...metadata.resources.map(resource => ({
                value: resource.value,
                label: resource.key.charAt(0).toUpperCase() + resource.key.slice(1),
            })),
        ];
    }, [metadata, t]);

    const organizationOptions = useMemo(() => [
        { value: "", label: t('audit.filters.options.allOrganizations') },
        { value: "personal", label: t('audit.filters.options.personalOnly') },
        ...organizations.map(org => ({ value: org.id.toString(), label: org.name })),
    ], [organizations, t]);

    const activeFilterCount = useMemo(() => Object.values(filters).filter(v => v && v !== "").length, [filters]);

    return (
        <div className="audit-filters">
            <div className={`filters-header ${expanded ? "expanded" : ""}`} onClick={() => setExpanded(!expanded)}>
                <div className="filters-title">
                    <Icon path={expanded ? mdiFilterVariantMinus : mdiFilterVariantPlus} />
                    <span>{t('audit.filters.title')}</span>
                </div>
                {activeFilterCount > 0 && (
                    <span className="filter-count">
                        {t('audit.filters.activeCount', { count: activeFilterCount })}
                    </span>
                )}
            </div>

            {expanded && (
                <div className="filters-content">
                    <div className="filters-row">
                        <div className="filter-group">
                            <label>{t('audit.filters.organization')}</label>
                            <SelectBox options={organizationOptions}
                                       selected={filters.organizationId || ""}
                                       setSelected={(value) => handleFilterChange("organizationId", value || null)}
                            />
                        </div>

                        <div className="filter-group">
                            <label>{t('audit.filters.action')}</label>
                            <SelectBox options={actionOptions} selected={filters.action}
                                       setSelected={(value) => handleFilterChange("action", value)} />
                        </div>

                        <div className="filter-group">
                            <label>{t('audit.filters.resource')}</label>
                            <SelectBox options={resourceOptions} selected={filters.resource}
                                       setSelected={(value) => handleFilterChange("resource", value)} />
                        </div>
                    </div>

                    <div className="filters-row">
                        <div className="filter-group">
                            <label>{t('audit.filters.startDate')}</label>
                            <input type="datetime-local" value={filters.startDate}
                                   onChange={(e) => handleFilterChange("startDate", e.target.value)}
                                   className="date-input" />
                        </div>

                        <div className="filter-group">
                            <label>{t('audit.filters.endDate')}</label>
                            <input type="datetime-local" value={filters.endDate}
                                   onChange={(e) => handleFilterChange("endDate", e.target.value)}
                                   className="date-input" />
                        </div>

                        <div className="filter-group filter-actions">
                            <Button text={t('audit.filters.clearAll')} type="secondary" onClick={clearFilters} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};