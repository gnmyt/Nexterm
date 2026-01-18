import "./styles.sass";
import {useState, useEffect, useRef, useCallback} from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faTag, faCalendar, faArrowUpRightFromSquare, faSpinner, faCircleExclamation} from "@fortawesome/free-solid-svg-icons";
import {faGithub} from "@fortawesome/free-brands-svg-icons";
import Footer from "@/pages/Home/components/Footer";

const GITHUB_API = "https://api.github.com/repos/gnmyt/Nexterm/releases";
const PER_PAGE = 5;

const parseChangelog = (body) => {
    if (!body) return null;
    
    const whatsChangedMatch = body.match(/## What's Changed\r?\n([\s\S]*?)(?=\r?\n\*\*Full Changelog\*\*|$)/);
    if (!whatsChangedMatch) return null;
    
    const changes = whatsChangedMatch[1]
        .split('\n')
        .filter(line => line.trim().startsWith('*'))
        .map(line => {
            const match = line.match(/\*\s+(.+?)\s+by\s+@(\w+)\s+in\s+(https:\/\/[^\s]+)/);
            if (match) {
                return {
                    title: match[1].replace(/^[^\w]*/, '').trim(),
                    author: match[2],
                    url: match[3]
                };
            }
            return {
                title: line.replace(/^\*\s*/, '').trim(),
                author: null,
                url: null
            };
        })
        .filter(change => change.title);
    
    return changes.length > 0 ? changes : null;
};

const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

const getVersionType = (tagName) => {
    if (tagName.includes('BETA')) return 'beta';
    if (tagName.includes('PREVIEW') || tagName.includes('ALPHA')) return 'preview';
    return 'stable';
};

export const Changelog = () => {
    const [releases, setReleases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const loaderRef = useRef(null);

    const fetchReleases = useCallback(async (pageNum, append = false) => {
        if (append) setLoadingMore(true);
        else setLoading(true);

        try {
            const response = await fetch(`${GITHUB_API}?per_page=${PER_PAGE}&page=${pageNum}`);
            if (!response.ok) throw new Error('Failed to fetch releases');
            const data = await response.json();
            
            if (data.length < PER_PAGE) setHasMore(false);
            if (data.length === 0) {
                setHasMore(false);
                return;
            }
            
            setReleases(prev => append ? [...prev, ...data] : data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, []);

    useEffect(() => {
        fetchReleases(1);
    }, [fetchReleases]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
                    setPage(prev => prev + 1);
                }
            },
            { threshold: 0.1 }
        );

        if (loaderRef.current) observer.observe(loaderRef.current);
        return () => observer.disconnect();
    }, [hasMore, loadingMore, loading]);

    useEffect(() => {
        if (page > 1) fetchReleases(page, true);
    }, [page, fetchReleases]);

    return (
        <div className="changelog-page">
            <div className="changelog-container">
                <div className="changelog-header">
                    <h1>Changelog</h1>
                    <p>Track the latest updates and improvements</p>
                </div>

                {loading && (
                    <div className="changelog-state">
                        <FontAwesomeIcon icon={faSpinner} spin />
                        <span>Loading releases...</span>
                    </div>
                )}

                {error && (
                    <div className="changelog-state error">
                        <FontAwesomeIcon icon={faCircleExclamation} />
                        <span>Failed to load releases</span>
                    </div>
                )}

                {!loading && !error && (
                    <div className="releases-timeline">
                        {releases.map((release, index) => {
                            const changes = parseChangelog(release.body);
                            const versionType = getVersionType(release.tag_name);
                            
                            return (
                                <article key={release.id} className="release-item">
                                    <div className="timeline-marker">
                                        <div className={`marker-dot ${versionType}`} />
                                        {index < releases.length - 1 && <div className="marker-line" />}
                                    </div>
                                    
                                    <div className="release-content">
                                        <header className="release-header">
                                            <div className="release-info">
                                                <span className={`version-tag ${versionType}`}>
                                                    <FontAwesomeIcon icon={faTag} />
                                                    {release.tag_name}
                                                </span>
                                                {index === 0 && <span className="latest-tag">Latest</span>}
                                            </div>
                                            <div className="release-actions">
                                                <time className="release-date">
                                                    <FontAwesomeIcon icon={faCalendar} />
                                                    {formatDate(release.published_at)}
                                                </time>
                                                <a 
                                                    href={release.html_url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="github-link"
                                                >
                                                    <FontAwesomeIcon icon={faGithub} />
                                                    <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                                                </a>
                                            </div>
                                        </header>

                                        {changes && changes.length > 0 ? (
                                            <ul className="changes-list">
                                                {changes.map((change, i) => (
                                                    <li key={i}>
                                                        <span className="change-text">
                                                            {change.url ? (
                                                                <a href={change.url} target="_blank" rel="noopener noreferrer">
                                                                    {change.title}
                                                                </a>
                                                            ) : (
                                                                change.title
                                                            )}
                                                        </span>
                                                        {change.author && (
                                                            <a 
                                                                className="author-link" 
                                                                href={`https://github.com/${change.author}`} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                            >
                                                                @{change.author}
                                                            </a>
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="no-changes">View release notes on GitHub</p>
                                        )}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}

                {hasMore && !loading && (
                    <div ref={loaderRef} className="load-more">
                        {loadingMore && (
                            <>
                                <FontAwesomeIcon icon={faSpinner} spin />
                                <span>Loading more...</span>
                            </>
                        )}
                    </div>
                )}

                {!hasMore && releases.length > 0 && (
                    <div className="end-message">You've reached the beginning</div>
                )}
            </div>
            <Footer />
        </div>
    );
};
