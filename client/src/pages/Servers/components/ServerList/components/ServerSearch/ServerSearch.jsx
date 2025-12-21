import "./styles.sass";
import Icon from "@mdi/react";
import { mdiMagnify } from "@mdi/js";
import { useEffect, useRef } from "react";
import { useKeymaps, matchesKeybind } from "@/common/contexts/KeymapContext.jsx";

export const ServerSearch = ({search, setSearch}) => {

    const inputRef = useRef(null);
    const { getParsedKeybind, formatKey } = useKeymaps();
    const searchKeybind = getParsedKeybind("search");

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (searchKeybind && matchesKeybind(e, searchKeybind)) {
                e.preventDefault();
                inputRef.current.focus();
            }
        }
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        }
    }, [searchKeybind]);

    return (
        <div className="server-search">
            <Icon path={mdiMagnify} className="search-icon" />
            <input className="search-input" placeholder="Search" ref={inputRef}
                value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="info-container" onClick={() => inputRef.current.focus()}>
                <p>{searchKeybind ? formatKey(searchKeybind.original) : "CTRL + S"}</p>
            </div>
        </div>
    )
}