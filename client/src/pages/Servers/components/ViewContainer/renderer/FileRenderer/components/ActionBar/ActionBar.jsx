import "./styles.sass";
import Icon from "@mdi/react";
import {
    mdiChevronLeft,
    mdiChevronRight,
    mdiChevronUp,
    mdiFileUpload,
    mdiFilePlus,
    mdiFolderPlus,
    mdiViewList,
    mdiViewGrid,
    mdiFileMove,
    mdiContentCopy,
} from "@mdi/js";
import { Fragment, useState, useRef, useEffect, useCallback } from "react";
import { ContextMenu, ContextMenuItem, useContextMenu } from "@/common/components/ContextMenu";
import { useTranslation } from "react-i18next";
import { usePreferences } from "@/common/contexts/PreferencesContext.jsx";

export const ActionBar = ({
                              path,
                              updatePath,
                              createFile,
                              createFolder,
                              uploadFile,
                              goBack,
                              goForward,
                              historyIndex,
                              historyLength,
                              viewMode = "list",
                              setViewMode,
                              searchDirectories,
                              directorySuggestions = [],
                              setDirectorySuggestions,
                              moveFiles,
                              copyFiles,
                              sessionId,
                          }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editPath, setEditPath] = useState(path);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
    const [pendingDrop, setPendingDrop] = useState(null);
    const { t } = useTranslation();
    const { dragDropAction } = usePreferences();
    const dropMenu = useContextMenu();

    const inputRef = useRef(null);
    const suggestionsRef = useRef(null);
    const breadcrumbRef = useRef(null);
    const isNavigatingWithKeyboardRef = useRef(false);
    const hoverTimerRef = useRef(null);

    const [dropTarget, setDropTarget] = useState(null);

    const getPathArray = () => path.split("/").filter(Boolean);

    const goUp = () => {
        const pathArray = getPathArray();
        pathArray.pop();
        updatePath(pathArray.length ? `/${pathArray.join("/")}` : "/");
    };

    const navigate = (displayIndex, isTruncated = false, originalIndex = null) => {
        const pathArray = getPathArray();
        updatePath(`/${pathArray.slice(0, (isTruncated ? originalIndex : displayIndex) + 1).join("/")}`);
    };

    const getTruncatedPathArray = () => {
        const pathArray = getPathArray();
        const total = pathArray.length;

        if (total <= 2 || !breadcrumbRef.current) {
            return { parts: pathArray, showEllipsis: total > 2, ellipsisIndex: 1, originalLength: total };
        }

        const containerWidth = breadcrumbRef.current.offsetWidth;
        const avgWidth = 80;
        const ellipsisWidth = 50;
        const available = containerWidth - 20 - ellipsisWidth;
        const maxParts = Math.floor(available / avgWidth);

        if (maxParts >= total) return { parts: pathArray, showEllipsis: false, ellipsisIndex: -1 };

        const visibleParts = Math.max(2, Math.min(maxParts, total));
        const end = Math.ceil(visibleParts / 2);
        const start = visibleParts - end;

        return {
            parts: [...pathArray.slice(0, start), ...pathArray.slice(-end)],
            showEllipsis: true,
            ellipsisIndex: start,
            originalLength: total,
        };
    };

    useEffect(() => {
        setEditPath(path);
    }, [path]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.setSelectionRange(editPath.length, editPath.length);
        }
    }, [isEditing]);

    useEffect(() => {
        if (!isEditing) return;

        if (editPath.length <= 1) {
            setShowSuggestions(false);
            setDirectorySuggestions?.([]);
            setSelectedSuggestion(-1);
            return;
        }

        const timeout = setTimeout(() => {
            searchDirectories?.(editPath);
            setShowSuggestions(true);
            if (!isNavigatingWithKeyboardRef.current) setSelectedSuggestion(-1);
            isNavigatingWithKeyboardRef.current = false;
        }, 300);

        return () => clearTimeout(timeout);
    }, [editPath, isEditing]);

    const handleInputKeyDown = (e) => {
        switch (e.key) {
            case "Enter": {
                e.preventDefault();
                const suggestion = directorySuggestions[selectedSuggestion];
                if (selectedSuggestion >= 0 && suggestion) {
                    setEditPath(suggestion);
                    updatePath(suggestion);
                    resetInputState();
                } else {
                    submitPath();
                }
                break;
            }
            case "Escape":
                cancelEdit();
                break;
            case "ArrowDown":
            case "ArrowUp":
                e.preventDefault();
                if (!directorySuggestions.length) return;
                isNavigatingWithKeyboardRef.current = true;
                setSelectedSuggestion((prev) => {
                    const len = directorySuggestions.length;
                    const newIndex = e.key === "ArrowDown"
                        ? (prev + 1) % len
                        : (prev - 1 + len) % len;

                    requestAnimationFrame(() => {
                        suggestionsRef.current?.children[newIndex]?.scrollIntoView({
                            block: "nearest",
                            behavior: "smooth",
                        });
                    });
                    return newIndex;
                });
                break;
            case "Tab": {
                e.preventDefault();
                const tabSuggestion = directorySuggestions[selectedSuggestion];
                if (tabSuggestion) {
                    const pathWithSlash = tabSuggestion.endsWith('/') ? tabSuggestion : tabSuggestion + '/';
                    setEditPath(pathWithSlash);
                    setShowSuggestions(false);
                    setDirectorySuggestions?.([]);
                }
                break;
            }
        }
    };

    const submitPath = () => {
        let newPath = editPath.trim();
        if (!newPath.startsWith("/")) newPath = "/" + newPath;
        if (newPath.length > 1 && newPath.endsWith("/")) newPath = newPath.slice(0, -1);
        updatePath(newPath);
        resetInputState();
    };

    const cancelEdit = () => {
        setEditPath(path);
        resetInputState();
    };

    const resetInputState = () => {
        setIsEditing(false);
        setShowSuggestions(false);
        setDirectorySuggestions?.([]);
    };

    const handleInputBlur = (e) => {
        if (suggestionsRef.current?.contains(e.relatedTarget)) return;
        setTimeout(() => {
            if (!showSuggestions) submitPath();
        }, 100);
    };

    const handlePathDragOver = useCallback((event, targetPath) => {
        if (!event.dataTransfer.types.includes("application/x-sftp-files")) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = event.ctrlKey || event.metaKey ? "copy" : "move";
        if (dropTarget !== targetPath) {
            setDropTarget(targetPath);
            if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = setTimeout(() => {
                updatePath(targetPath);
                setDropTarget(null);
            }, 800);
        }
    }, [dropTarget, updatePath]);

    const handlePathDragLeave = useCallback(() => {
        setDropTarget(null);
        if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = null;
        }
    }, []);

    const handlePathDrop = useCallback((event, targetPath) => {
        event.preventDefault();
        event.stopPropagation();
        if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = null;
        }
        setDropTarget(null);
        try {
            const data = JSON.parse(event.dataTransfer.getData("application/x-sftp-files"));
            if (!data?.paths?.length) return;
            if (!data.sessionId || data.sessionId !== sessionId) return;
            if (dragDropAction === "move") {
                moveFiles?.(data.paths, targetPath);
            } else if (dragDropAction === "copy") {
                copyFiles?.(data.paths, targetPath);
            } else {
                setPendingDrop({ paths: data.paths, destination: targetPath });
                dropMenu.open(event, { x: event.clientX, y: event.clientY });
            }
        } catch {}
    }, [sessionId, dropMenu, dragDropAction, moveFiles, copyFiles]);

    const handleDropAction = useCallback((action) => {
        if (pendingDrop) {
            action === "move" ? moveFiles?.(pendingDrop.paths, pendingDrop.destination) : copyFiles?.(pendingDrop.paths, pendingDrop.destination);
            setPendingDrop(null);
        }
        dropMenu.close();
    }, [pendingDrop, moveFiles, copyFiles, dropMenu]);

    const renderBreadcrumbs = () => {
        const { parts, showEllipsis, ellipsisIndex, originalLength } = getTruncatedPathArray();
        const fullArray = getPathArray();

        return (
            <>
                <div 
                    className={`path-part-divider root-drop ${dropTarget === "/" ? "drop-target" : ""}`}
                    onClick={(e) => { e.stopPropagation(); updatePath("/"); }}
                    onDragOver={(e) => handlePathDragOver(e, "/")}
                    onDragLeave={handlePathDragLeave}
                    onDrop={(e) => handlePathDrop(e, "/")}
                >/
                </div>
                {parts.map((part, i) => {
                    const originalIndex = showEllipsis ? (i === 0 ? 0 : fullArray.length - (parts.length - i)) : i;
                    const targetPath = `/${fullArray.slice(0, originalIndex + 1).join("/")}`;
                    const isDropping = dropTarget === targetPath;

                    return (
                        <Fragment key={`${originalIndex}-${part}`}>
                            {showEllipsis && i === ellipsisIndex && (
                                <>
                                    <div className="path-part ellipsis"
                                         title={t("servers.fileManager.actionBar.hiddenDirectories", { count: originalLength - parts.length + 1 })}>
                                        ...
                                    </div>
                                    <div className="path-part-divider">/</div>
                                </>
                            )}
                            <div 
                                title={part} 
                                className={`path-part ${isDropping ? "drop-target" : ""}`}
                                onClick={(e) => { e.stopPropagation(); navigate(i, showEllipsis, originalIndex); }}
                                onDragOver={(e) => handlePathDragOver(e, targetPath)}
                                onDragLeave={handlePathDragLeave}
                                onDrop={(e) => handlePathDrop(e, targetPath)}
                            >{part}</div>
                            <div className="path-part-divider">/</div>
                        </Fragment>
                    );
                })}
            </>
        );
    };

    return (
        <div className="action-bar">
            <Icon path={mdiChevronLeft} onClick={goBack} className={historyIndex === 0 ? " nav-disabled" : ""} />
            <Icon path={mdiChevronRight} onClick={goForward}
                  className={historyIndex === historyLength - 1 ? " nav-disabled" : ""} />
            <Icon path={mdiChevronUp} onClick={goUp} className={path === "/" ? " nav-disabled" : ""} />

            <div className="address-bar" onClick={() => setIsEditing(true)}>
                {isEditing ? (
                    <div className="path-input-container">
                        <input ref={inputRef} className="path-input" type="text" value={editPath}
                               onChange={(e) => setEditPath(e.target.value)} onKeyDown={handleInputKeyDown}
                               onBlur={handleInputBlur} placeholder={t("servers.fileManager.actionBar.enterDirectory")} autoComplete="off"
                               spellCheck="false" />
                        {showSuggestions && directorySuggestions.length > 0 && (
                            <div className="suggestions-dropdown" ref={suggestionsRef}>
                                {directorySuggestions.map((s, i) => (
                                    <div className={`suggestion-item ${i === selectedSuggestion ? "selected" : ""}`}
                                         key={s} onMouseEnter={() => setSelectedSuggestion(i)}
                                         onMouseDown={(e) => {
                                             e.preventDefault();
                                             setEditPath(s);
                                             updatePath(s);
                                             resetInputState();
                                         }}>
                                        {s}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="breadcrumb-container" ref={breadcrumbRef}>
                        {renderBreadcrumbs()}
                    </div>
                )}
            </div>

            <div className="file-actions">
                <Icon path={viewMode === "list" ? mdiViewGrid : mdiViewList}
                      onClick={() => setViewMode(viewMode === "list" ? "grid" : "list")}
                      title={viewMode === "list" ? t("servers.fileManager.actionBar.switchToGrid") : t("servers.fileManager.actionBar.switchToList")} />
                <Icon path={mdiFileUpload} onClick={uploadFile} />
                <Icon path={mdiFilePlus} onClick={createFile} />
                <Icon path={mdiFolderPlus} onClick={createFolder} />
            </div>

            <ContextMenu isOpen={dropMenu.isOpen} position={dropMenu.position} onClose={() => { dropMenu.close(); setPendingDrop(null); }}>
                <ContextMenuItem icon={mdiFileMove} label={t("servers.fileManager.contextMenu.moveHere")} onClick={() => handleDropAction("move")} />
                <ContextMenuItem icon={mdiContentCopy} label={t("servers.fileManager.contextMenu.copyHere")} onClick={() => handleDropAction("copy")} />
            </ContextMenu>
        </div>
    );
};

