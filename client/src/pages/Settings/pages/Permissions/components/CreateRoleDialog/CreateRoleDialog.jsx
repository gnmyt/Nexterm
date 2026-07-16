import "./styles.sass";
import { useEffect, useState } from "react";
import { DialogProvider } from "@/common/components/Dialog";
import Input from "@/common/components/IconInput";
import Button from "@/common/components/Button";
import { mdiShieldAccountOutline } from "@mdi/js";
import { postRequest } from "@/common/utils/RequestUtil.js";
import { useTranslation } from "react-i18next";
import { PRESET_COLORS } from "../../constants";

export const CreateRoleDialog = ({ open, onClose, onCreated }) => {
    const { t } = useTranslation();
    const [name, setName] = useState("");
    const [color, setColor] = useState(PRESET_COLORS[0]);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open) {
            setName("");
            setColor(PRESET_COLORS[0]);
            setError("");
        }
    }, [open]);

    const submit = async () => {
        if (!name.trim()) return setError(t("settings.permissions.nameRequired"));
        try {
            onCreated?.(await postRequest("permissions/groups", { name: name.trim(), color }));
            onClose();
        } catch (err) {
            setError(err.message || t("settings.permissions.saveError"));
        }
    };

    return (
        <DialogProvider open={open} onClose={onClose} isDirty={name !== ""}>
            <div className="create-role-dialog" onKeyDown={(e) => e.key === "Enter" && submit()}>
                <h2>{t("settings.permissions.createRole")}</h2>
                {error && <div className="error">{error}</div>}

                <div className="form-group">
                    <label htmlFor="role-name">{t("settings.permissions.roleName")}</label>
                    <Input id="role-name" icon={mdiShieldAccountOutline} autoFocus
                           placeholder={t("settings.permissions.roleNamePlaceholder")}
                           value={name} setValue={setName} />
                </div>

                <div className="form-group">
                    <label>{t("settings.permissions.roleColor")}</label>
                    <div className="color-swatches">
                        {PRESET_COLORS.map((c) => (
                            <button key={c} type="button" style={{ backgroundColor: c }}
                                    className={`swatch ${color === c ? "selected" : ""}`}
                                    onClick={() => setColor(c)} />
                        ))}
                    </div>
                </div>

                <div className="btn-area">
                    <Button text={t("settings.permissions.createRole")} onClick={submit} />
                </div>
            </div>
        </DialogProvider>
    );
};