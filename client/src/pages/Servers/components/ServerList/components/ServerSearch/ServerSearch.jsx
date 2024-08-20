import "./styles.sass";
import Icon from "@mdi/react";
import { mdiMagnify } from "@mdi/js";
import { useEffect, useRef } from "react";

export const ServerSearch = ({search, setSearch}) => {

    const inputRef = useRef(null);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey && e.key === "s") {
                e.preventDefault();
                inputRef.current.focus();
            }
        }
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        }
    }, []);

    return (
        <div className="server-search">
            <Icon path={mdiMagnify} className="search-icon" />
            <input className="search-input" placeholder="Search" ref={inputRef}
                value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="info-container" onClick={() => inputRef.current.focus()}>
                <p>CTRL + S</p>
            </div>
        </div>
    )
}