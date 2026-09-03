import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { isTauri } from "@/common/utils/TauriUtil.js";
import {
    browserDownload, browserFormDownload, browserUpload, createTransferId, isCancelledError,
    nativeCancel, nativeDownload, nativeUpload, pickSavePath,
} from "@/common/utils/TransferUtil.js";

const TransferContext = createContext(null);

export const useTransfers = () => useContext(TransferContext);

export const TRANSFER_OPERATIONS = { TRANSFER_PROGRESS: 0x13, CANCEL_TRANSFER: 0x14 };

const DONE_RETENTION_MS = 6000;
const SPEED_SAMPLE_MS = 500;
const FINAL_STATES = new Set(["done", "error", "cancelled"]);

const joinPath = (...parts) => parts.join("/").replace(/\/+/g, "/");

export const isTransferFinished = (transfer) => FINAL_STATES.has(transfer.state);

export const TransferProvider = ({ children }) => {
    const [transfers, setTransfers] = useState([]);
    const transfersRef = useRef(transfers);
    const sessionHandlersRef = useRef(new Map());
    const controlsRef = useRef(new Map());
    const rateRef = useRef(new Map());
    const uploadQueuesRef = useRef(new Map());

    useEffect(() => { transfersRef.current = transfers; }, [transfers]);

    const updateTransfer = useCallback((id, patch) => {
        setTransfers((prev) => prev.map((transfer) => transfer.id === id
            ? { ...transfer, ...(typeof patch === "function" ? patch(transfer) : patch), updatedAt: Date.now() }
            : transfer));
    }, []);

    const removeTransfer = useCallback((id) => {
        controlsRef.current.delete(id);
        rateRef.current.delete(id);
        setTransfers((prev) => prev.filter((transfer) => transfer.id !== id));
    }, []);

    const addTransfer = useCallback((transfer) => {
        const entry = {
            transferred: 0, total: 0, speed: 0, error: null, state: "active",
            startedAt: Date.now(), updatedAt: Date.now(), ...transfer,
        };
        setTransfers((prev) => [...prev.filter((existing) => existing.id !== entry.id), entry]);
        return entry;
    }, []);

    const computeSpeed = useCallback((id, transferred) => {
        const now = Date.now();
        const sample = rateRef.current.get(id);
        if (!sample) {
            rateRef.current.set(id, { bytes: transferred, time: now, speed: 0 });
            return 0;
        }
        const elapsed = now - sample.time;
        if (elapsed < SPEED_SAMPLE_MS) return sample.speed;
        const instant = ((transferred - sample.bytes) * 1000) / elapsed;
        const speed = sample.speed ? sample.speed * 0.6 + instant * 0.4 : instant;
        rateRef.current.set(id, { bytes: transferred, time: now, speed });
        return speed;
    }, []);

    const reportProgress = useCallback((id, transferred, total) => {
        updateTransfer(id, (transfer) => ({
            transferred,
            total: total || transfer.total,
            speed: computeSpeed(id, transferred),
        }));
    }, [updateTransfer, computeSpeed]);

    const finishTransfer = useCallback((id, { error = null, cancelled = false, detail = null } = {}) => {
        controlsRef.current.delete(id);
        rateRef.current.delete(id);
        const state = cancelled ? "cancelled" : error ? "error" : "done";
        updateTransfer(id, (transfer) => ({
            state, error, detail, speed: 0,
            transferred: state === "done" && transfer.total ? transfer.total : transfer.transferred,
        }));
        if (state === "done") setTimeout(() => removeTransfer(id), DONE_RETENTION_MS);
    }, [updateTransfer, removeTransfer]);

    const settle = useCallback((id, error, detail) => {
        if (!error) finishTransfer(id, { detail });
        else if (isCancelledError(error)) finishTransfer(id, { cancelled: true });
        else finishTransfer(id, { error: error.message });
    }, [finishTransfer]);

    const registerSession = useCallback((sessionId, handlers) => {
        sessionHandlersRef.current.set(sessionId, handlers);
        return () => {
            if (sessionHandlersRef.current.get(sessionId) === handlers) sessionHandlersRef.current.delete(sessionId);
        };
    }, []);

    const runNativeDownload = useCallback(async ({ id, sessionId, name, url, method, body, filters }) => {
        const destination = await pickSavePath({ fileName: name, filters });
        if (!destination) return;

        addTransfer({ id, sessionId, name, direction: "download", source: "native" });
        controlsRef.current.set(id, { cancel: () => nativeCancel(id) });
        try {
            await nativeDownload({
                id, url, method, body, destination,
                headers: body ? { "Content-Type": "application/json" } : {},
                onProgress: (transferred, total) => reportProgress(id, transferred, total),
            });
            finishTransfer(id, { detail: destination });
        } catch (error) {
            settle(id, error);
        }
    }, [addTransfer, reportProgress, finishTransfer, settle]);

    const startDownload = useCallback(({ sessionId, sessionToken, baseUrl, path }) => {
        const id = createTransferId();
        const name = path.split("/").pop() || "download";
        const url = `${baseUrl}/api/entries/sftp?sessionId=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(path)}`
            + `&sessionToken=${encodeURIComponent(sessionToken)}&transferId=${id}`;

        if (isTauri()) {
            runNativeDownload({ id, sessionId, name, url, method: "GET" });
            return id;
        }

        addTransfer({ id, sessionId, name, direction: "download", source: "server" });
        browserDownload({ url, fileName: name });
        return id;
    }, [runNativeDownload, addTransfer]);

    const startMultiDownload = useCallback(({ sessionId, sessionToken, baseUrl, paths }) => {
        if (!paths?.length) return null;
        const id = createTransferId();
        const name = paths.length === 1 ? `${paths[0].split("/").pop()}.zip` : "files.zip";
        const url = `${baseUrl}/api/entries/sftp/multi?sessionId=${encodeURIComponent(sessionId)}`
            + `&sessionToken=${encodeURIComponent(sessionToken)}&transferId=${id}`;

        if (isTauri()) {
            runNativeDownload({
                id, sessionId, name, url, method: "POST", body: JSON.stringify({ paths }),
                filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
            });
            return id;
        }

        addTransfer({ id, sessionId, name, direction: "download", source: "server" });
        browserFormDownload({ url, fields: { paths: JSON.stringify(paths) } });
        return id;
    }, [runNativeDownload, addTransfer]);

    const uploadOne = useCallback(async ({ id, sessionId, sessionToken, baseUrl, file, targetDir }) => {
        const remotePath = joinPath(targetDir, file.name);
        const url = `${baseUrl}/api/entries/sftp/upload?sessionId=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(remotePath)}`
            + `&sessionToken=${encodeURIComponent(sessionToken)}&transferId=${id}`;
        const abortController = new AbortController();
        controlsRef.current.set(id, { cancel: () => abortController.abort() });
        updateTransfer(id, { state: "active", startedAt: Date.now() });

        const options = {
            id, url, file, signal: abortController.signal,
            onProgress: (transferred, total) => reportProgress(id, transferred, total),
        };
        return isTauri() ? nativeUpload(options) : browserUpload(options);
    }, [updateTransfer, reportProgress]);

    const processUploadQueue = useCallback(async (sessionId) => {
        const queue = uploadQueuesRef.current.get(sessionId);
        if (!queue || queue.running) return;
        queue.running = true;

        while (queue.items.length > 0) {
            const item = queue.items.shift();
            const current = transfersRef.current.find((transfer) => transfer.id === item.id);
            if (current && isTransferFinished(current)) continue;
            try {
                await uploadOne(item);
                finishTransfer(item.id);
            } catch (error) {
                settle(item.id, error);
            }
        }

        queue.running = false;
        sessionHandlersRef.current.get(sessionId)?.refresh?.();
    }, [uploadOne, finishTransfer, settle]);

    const queueUploads = useCallback(({ sessionId, sessionToken, baseUrl, uploads }) => {
        if (!uploads.length) return;
        if (!uploadQueuesRef.current.has(sessionId)) uploadQueuesRef.current.set(sessionId, { items: [], running: false });
        const queue = uploadQueuesRef.current.get(sessionId);

        for (const { file, targetDir } of uploads) {
            const id = createTransferId();
            addTransfer({
                id, sessionId, name: file.name, direction: "upload", source: "local",
                total: file.size, state: "queued",
            });
            queue.items.push({ id, sessionId, sessionToken, baseUrl, file, targetDir });
        }
        processUploadQueue(sessionId);
    }, [addTransfer, processUploadQueue]);

    const applyServerProgress = useCallback((sessionId, payload) => {
        if (!payload?.id) return;
        const existing = transfersRef.current.find((transfer) => transfer.id === payload.id);
        if (existing && existing.source !== "server") return;
        if (existing && isTransferFinished(existing)) return;

        const final = FINAL_STATES.has(payload.state);
        if (!existing) {
            if (final) return;
            addTransfer({
                id: payload.id, sessionId, name: payload.name, direction: payload.direction, source: "server",
                total: payload.total, transferred: payload.transferred,
            });
            return;
        }

        if (!final) {
            if (payload.name && payload.name !== existing.name) updateTransfer(payload.id, { name: payload.name });
            reportProgress(payload.id, payload.transferred, payload.total);
            return;
        }

        finishTransfer(payload.id, { error: payload.error, cancelled: payload.state === "cancelled" });
    }, [addTransfer, updateTransfer, reportProgress, finishTransfer]);

    const cancelTransfer = useCallback((id) => {
        const transfer = transfersRef.current.find((entry) => entry.id === id);
        if (!transfer || isTransferFinished(transfer)) return;

        if (transfer.state === "queued") {
            const queue = uploadQueuesRef.current.get(transfer.sessionId);
            if (queue) queue.items = queue.items.filter((item) => item.id !== id);
            finishTransfer(id, { cancelled: true });
            return;
        }

        updateTransfer(id, { state: "cancelling" });
        const control = controlsRef.current.get(id);
        if (control) {
            control.cancel();
            return;
        }
        const sent = sessionHandlersRef.current.get(transfer.sessionId)?.send?.(TRANSFER_OPERATIONS.CANCEL_TRANSFER, { id });
        if (!sent) finishTransfer(id, { cancelled: true });
    }, [updateTransfer, finishTransfer]);

    const clearFinished = useCallback((sessionId) => {
        setTransfers((prev) => prev.filter((transfer) => transfer.sessionId !== sessionId || !isTransferFinished(transfer)));
    }, []);

    const value = useMemo(() => ({
        transfers, registerSession, startDownload, startMultiDownload, queueUploads,
        applyServerProgress, cancelTransfer, dismissTransfer: removeTransfer, clearFinished,
    }), [transfers, registerSession, startDownload, startMultiDownload, queueUploads, applyServerProgress, cancelTransfer, removeTransfer, clearFinished]);

    return <TransferContext.Provider value={value}>{children}</TransferContext.Provider>;
};
