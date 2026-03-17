import { createContext, useContext, useState, useCallback } from "react";
import "@/common/styles/toast.sass";
import Icon from "@mdi/react";
import { mdiAlert, mdiAlertCircle, mdiCheckCircle, mdiClose, mdiInformation } from "@mdi/js";

const ToastContext = createContext({});

const DEFAULT_ICONS = {
    Success: mdiCheckCircle,
    Error: mdiAlertCircle,
    Warning: mdiAlert,
    Info: mdiInformation,
};

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const sendToast = useCallback((title, description, icon = null, duration = 5000) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const defaultIcon = DEFAULT_ICONS[title] || DEFAULT_ICONS.Info;

        setToasts((prev) => [...prev, { id, title, description, icon: icon || defaultIcon, duration }]);

        if (duration !== Infinity) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }

        return id;
    }, []);

    const removeToast = useCallback((id) => {
        setToasts((prev) => {
            const toast = document.getElementById(id);
            if (toast) {
                toast.classList.add("toast-exit");

                setTimeout(() => {
                    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
                }, 300);

                return prev;
            }
            return prev.filter((toast) => toast.id !== id);
        });
    }, []);

    return (
        <ToastContext.Provider value={{ sendToast, removeToast }}>
            {children}
            <div className="toast-container">
                {toasts.map((toast) => (
                    <div key={toast.id} id={toast.id} className={`toast ${!toast.description ? 'no-description' : ''}`} data-type={toast.title}>
                        <div className="toast-icon">
                            <Icon path={toast.icon} />
                        </div>
                        <div className="toast-content">
                            {toast.title && <div className="toast-title">{toast.title}</div>}
                            {toast.description && <div className="toast-description">{toast.description}</div>}
                        </div>
                        <button className="toast-close" onClick={() => removeToast(toast.id)}>
                            <Icon path={mdiClose} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};