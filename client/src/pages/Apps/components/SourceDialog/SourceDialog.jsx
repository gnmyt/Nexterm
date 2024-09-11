import "./styles.sass";
import { DialogProvider } from "@/common/components/Dialog";
import { useEffect, useState } from "react";
import { getRequest, postRequest } from "@/common/utils/RequestUtil.js";
import SourceItem from "@/pages/Apps/components/SourceDialog/components/SourceItem";
import Button from "@/common/components/Button";

export const SourceDialog = ({ open, onClose, refreshApps }) => {

    const [createNew, setCreateNew] = useState(false);

    const [sources, setSources] = useState([]);

    const fetchSources = async () => {
        try {
            const response = await getRequest("apps/sources");
            setSources(response);
        } catch (error) {
            console.error(error);
        }
    };

    const refreshSources = async () => {
        try {
            postRequest("apps/refresh").then(() => refreshApps());
            onClose();
        } catch (error) {
            console.error(error);
        }
    }

    useEffect(() => {
        if (open) {
            fetchSources();
            setCreateNew(false);
        }
    }, [open]);

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="source-dialog">
                <h2>App sources</h2>

                <div className="source-list">
                    {sources.map((source) => (
                        <SourceItem key={source.name} {...source} />
                    ))}
                    {createNew && <SourceItem isNew />}
                </div>

                <div className="btn-actions">
                    <Button onClick={refreshSources} text="Refresh apps" />
                    <Button onClick={() => setCreateNew(true)} text="Add new source" />
                </div>
            </div>
        </DialogProvider>
    );
};