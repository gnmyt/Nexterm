import Icon from "@mdi/react";
import { mdiBook, mdiChevronDown, mdiChevronUp, mdiContentSave, mdiFormTextbox, mdiTrashCan, mdiWeb } from "@mdi/js";
import IconInput from "@/common/components/IconInput";
import "./styles.sass";
import { useEffect, useState } from "react";
import { deleteRequest, patchRequest, putRequest } from "@/common/utils/RequestUtil.js";

export const SourceItem = ({ name, url, isNew, fetchSources, setCreateNew }) => {

    const [isOpen, setIsOpen] = useState(isNew);

    const [error, setError] = useState("");

    const [unsavedChanges, setUnsavedChanges] = useState(true);

    const [currentName, setCurrentName] = useState(name || "");
    const [currentUrl, setCurrentUrl] = useState(url || "");

    const deleteSelf = () => {
        deleteRequest("apps/sources/" + encodeURIComponent(name)).then(() => fetchSources()).catch(err => setError(err.message));
    };

    const updateChanges = () => {
        patchRequest("apps/sources/" + encodeURIComponent(name), { url: currentUrl }).then(() => {
            fetchSources();
            setUnsavedChanges(false);
        }).catch(err => setError(err.message));
    }

    const createSource = () => {
        putRequest("apps/sources", { name: currentName, url: currentUrl }).then(() => {
            fetchSources();
            setCreateNew(false);
        }).catch(err => setError(err.message));
    };

    useEffect(() => {
        setUnsavedChanges(currentName !== name || currentUrl !== url);

        setError("");
    }, [currentName, currentUrl]);

    return (
        <div className="source-item">
            <div className={"source-header" + (name === "official" ? " header-official" : "")}>
                <div className="source-info">
                    <Icon path={mdiBook} />
                    <h2>{name === "official" ? "Official" : isNew && currentName === "" ? "New source" : currentName}</h2>
                    {name === "official" &&
                        <span>@ {url?.toString().replace("https://", "").replace("http://", "").split("/")[0]}</span>}
                </div>
                <div className="action-area">
                    {name !== "official" && !isNew &&
                        <Icon path={mdiTrashCan} onClick={() => deleteSelf()} className="action-delete" />}
                    {name !== "official" &&
                        <Icon path={isOpen ? (unsavedChanges ? mdiContentSave : mdiChevronUp) : mdiChevronDown}
                              onClick={() => unsavedChanges ? (isNew ? createSource() : updateChanges()) : setIsOpen(!isOpen)}
                                className="action-open" />}
                </div>
            </div>

            {isOpen && <div className="edit-area">
                {error && <div className="error">{error}</div>}

                {isNew && <div className="edit-row">
                    <h3>Name</h3>
                    <IconInput icon={mdiFormTextbox} value={currentName} setValue={setCurrentName}
                               placeholder="Source name" />
                </div>}
                <div className="edit-row">
                    <h3>URL</h3>
                    <IconInput icon={mdiWeb} value={currentUrl} setValue={setCurrentUrl}
                               placeholder="Source URL" />
                </div>
            </div>}
        </div>
    );
};