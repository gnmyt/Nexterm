import { useState, useMemo, useCallback } from "react";
import Icon from "@mdi/react";
import { mdiFilterVariantPlus, mdiFilterVariantMinus } from "@mdi/js";
import SelectBox from "@/common/components/SelectBox";
import Button from "@/common/components/Button";
import "./styles.sass";

export const AuditFilters = ({ filters, metadata, organizations, onChange }) => {
    const [expanded, setExpanded] = useState(false);

    const handleFilterChange = useCallback((key, value) => {
        onChange({ [key]: value });
    }, [onChange]);

    const clearFilters = useCallback(() => {
        onChange({ organizationId: null, action: "", resource: "", startDate: "", endDate: "" });
    }, [onChange]);

    const actionOptions = useMemo(() => {
        if (!metadata?.actionCategories) return [];

        const options = [{ value: "", label: "All Actions" }];

        metadata.actionCategories.forEach(category => {
            options.push({
                value: `${category.key}.*`,
                label: `${category.label} (All)`,
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
    }, [metadata]);

    const resourceOptions = useMemo(() => {
        if (!metadata?.resources) return [{ value: "", label: "All Resources" }];

        return [
            { value: "", label: "All Resources" },
            ...metadata.resources.map(resource => ({
                value: resource.value,
                label: resource.key.charAt(0).toUpperCase() + resource.key.slice(1),
            })),
        ];
    }, [metadata]);

    const organizationOptions = useMemo(() => [
        { value: "", label: "All Organizations (Personal + Org)" },
        { value: "personal", label: "Personal Only" },
        ...organizations.map(org => ({ value: org.id.toString(), label: org.name })),
    ], [organizations]);

    const activeFilterCount = useMemo(() => Object.values(filters).filter(v => v && v !== "").length, [filters]);

    return (
        <div className="audit-filters">
            <div className={`filters-header ${expanded ? "expanded" : ""}`} onClick={() => setExpanded(!expanded)}>
                <div className="filters-title">
                    <Icon path={expanded ? mdiFilterVariantMinus : mdiFilterVariantPlus} />
                    <span>Filters</span>
                </div>
                {activeFilterCount > 0 && (
                    <span className="filter-count">
                        {activeFilterCount} active
                    </span>
                )}
            </div>

            {expanded && (
                <div className="filters-content">
                    <div className="filters-row">
                        <div className="filter-group">
                            <label>Organization</label>
                            <SelectBox options={organizationOptions}
                                       selected={filters.organizationId || ""}
                                       setSelected={(value) => handleFilterChange("organizationId", value === "personal" ? null : value || null)}
                            />
                        </div>

                        <div className="filter-group">
                            <label>Action</label>
                            <SelectBox options={actionOptions} selected={filters.action}
                                       setSelected={(value) => handleFilterChange("action", value)} />
                        </div>

                        <div className="filter-group">
                            <label>Resource</label>
                            <SelectBox options={resourceOptions} selected={filters.resource}
                                       setSelected={(value) => handleFilterChange("resource", value)} />
                        </div>
                    </div>

                    <div className="filters-row">
                        <div className="filter-group">
                            <label>Start Date</label>
                            <input type="datetime-local" value={filters.startDate}
                                   onChange={(e) => handleFilterChange("startDate", e.target.value)}
                                   className="date-input" />
                        </div>

                        <div className="filter-group">
                            <label>End Date</label>
                            <input type="datetime-local" value={filters.endDate}
                                   onChange={(e) => handleFilterChange("endDate", e.target.value)}
                                   className="date-input" />
                        </div>

                        <div className="filter-group filter-actions">
                            <Button text="Clear All" type="secondary" onClick={clearFilters} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};