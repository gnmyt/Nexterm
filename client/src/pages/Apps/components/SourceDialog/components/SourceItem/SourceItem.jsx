import Icon from "@mdi/react";
import { mdiBook, mdiChevronDown, mdiChevronUp, mdiFormTextbox, mdiTrashCan, mdiWeb } from "@mdi/js";
import IconInput from "@/common/components/IconInput";
import "./styles.sass";
import { useState } from "react";

export const SourceItem = ({ name, url, isNew }) => {

    const [isOpen, setIsOpen] = useState(isNew);

    const [currentName, setCurrentName] = useState(name);
    const [currentUrl, setCurrentUrl] = useState(url);

    const deleteSelf = () => {
        console.log("Delete source");
    }

    return (
        <div className="source-item">
            <div className={"source-header" + (name === "official" ? " header-official" : "")}
                 onClick={() => name === "official" ? null : setIsOpen(!isOpen)}>
                <div className="source-info">
                    <Icon path={mdiBook} />
                    <h2>{name === "official" ? "Official" : isNew ? "New source" : name}</h2>
                    {name === "official" &&
                        <span>@ {url?.toString().replace("https://", "").replace("http://", "").split("/")[0]}</span>}
                </div>
                <div class="action-area">
                    {name !== "official" && <Icon path={mdiTrashCan} onClick={() => console.log("Delete source")} />}
                    {name !== "official" && <Icon path={isOpen ? mdiChevronUp : mdiChevronDown} />}
                </div>
            </div>

            {isOpen && <div className="edit-area">
                <div className="edit-row">
                    <h3>Name</h3>
                    <IconInput icon={mdiFormTextbox} value={currentName} onChange={setCurrentName}
                               placeholder="Source name" />
                </div>
                <div className="edit-row">
                    <h3>URL</h3>
                    <IconInput icon={mdiWeb} value={currentUrl} onChange={setCurrentUrl}
                               placeholder="Source URL" />
                </div>
            </div>}
        </div>
    );
};