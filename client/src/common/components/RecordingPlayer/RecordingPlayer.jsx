import { useEffect, useState, useRef } from "react";
import "asciinema-player/dist/bundle/asciinema-player.css";

const RecordingPlayer = ({ url, type: forcedType }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [recordingData, setRecordingData] = useState(null);
    const playerRef = useRef(null);
    const containerRef = useRef(null);

    const detectType = (url, forcedType) => {
        if (forcedType) return forcedType;

        const extension = url.split("?")[0].split(".").pop().toLowerCase();
        if (extension === "cast") return "asciinema";
        if (extension === "guac") return "guacamole";
        if (extension === "gz") {
            const baseName = url.split("?")[0].split(".").slice(-2)[0].toLowerCase();
            if (baseName === "cast") return "asciinema";
            if (baseName === "guac") return "guacamole";
        }
        return "asciinema";
    };

    const decompressGz = async (arrayBuffer) => {
        const stream = new Blob([arrayBuffer]).stream();
        const decompressedStream = stream.pipeThrough(new DecompressionStream("gzip"));
        const reader = decompressedStream.getReader();
        const chunks = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }

        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }

        return result;
    };

    const loadRecording = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to load recording: ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const recordingType = detectType(url, forcedType);
            const isGzipped = url.toLowerCase().endsWith(".gz");

            let data;
            if (isGzipped) {
                data = await decompressGz(arrayBuffer);
            } else {
                data = new Uint8Array(arrayBuffer);
            }

            const text = new TextDecoder("utf-8").decode(data);

            setRecordingData({
                type: recordingType,
                content: text,
                raw: data,
            });
        } catch (err) {
            setError(err.message || "Failed to load recording");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (url) {
            loadRecording();
        }

        return () => {
            if (playerRef.current) {
                playerRef.current = null;
            }
        };
    }, [url, forcedType]);

    useEffect(() => {
        if (recordingData?.type === "asciinema" && containerRef.current && !playerRef.current) {
            const loadAsciinema = async () => {
                const { default: AsciinemaPlayer } = await import("asciinema-player");

                playerRef.current = AsciinemaPlayer.create(recordingData.content, containerRef.current, {
                    autoPlay: true,
                    loop: true,
                    preload: true,
                    fit: false,
                    fontSize: "small",
                    theme: "monokai",
                });
            };

            loadAsciinema();
        }
    }, [recordingData]);

    if (loading) {
        return (
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "var(--text-secondary, #9ca3af)"
            }}>
                Loading recording...
            </div>
        );
    }

    if (error) {
        return (
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "var(--color-error, #ef4444)"
            }}>
                {error}
            </div>
        );
    }

    if (recordingData?.type === "asciinema") {
        return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
    }

    if (recordingData?.type === "guacamole") {
        return (
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "var(--text-secondary, #9ca3af)"
            }}>
                Guacamole recordings are not yet supported in the web client.
            </div>
        );
    }

    return (
        <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            color: "var(--text-secondary, #9ca3af)"
        }}>
            Unknown recording format.
        </div>
    );
};

export default RecordingPlayer;
