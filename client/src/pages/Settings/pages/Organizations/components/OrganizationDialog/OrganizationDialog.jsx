import { useEffect, useState } from "react";
import { DialogProvider } from "@/common/components/Dialog";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import IconInput from "@/common/components/IconInput";
import { mdiDomain, mdiFormTextbox } from "@mdi/js";
import Button from "@/common/components/Button";
import { putRequest } from "@/common/utils/RequestUtil.js";
import "./styles.sass";

export const OrganizationDialog = ({ open, onClose, refreshOrganizations }) => {
    const { sendToast } = useToast();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");

    useEffect(() => {
        if (!open) {
            setName("");
            setDescription("");
        }
    }, [open]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!name.trim()) {
            sendToast("Error", "Organization name is required");
            return;
        }

        try {
            await putRequest("organizations", {
                name: name.trim(),
                description: description.trim() || undefined
            });
            
            sendToast("Success", "Organization created successfully");
            refreshOrganizations();
            onClose();
        } catch (error) {
            sendToast("Error", error.message || "Failed to create organization");
        }
    };

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="organization-dialog">
                <h2>Create Organization</h2>
                
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="name">Name</label>
                        <IconInput
                            icon={mdiDomain}
                            id="name"
                            placeholder="Organization name"
                            value={name}
                            setValue={setName}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="description">Description (optional)</label>
                        <IconInput
                            icon={mdiFormTextbox}
                            id="description"
                            placeholder="Brief description of your organization"
                            value={description}
                            setValue={setDescription}
                        />
                    </div>

                    <div className="dialog-actions">
                        <Button text="Cancel" onClick={onClose} type="secondary" />
                        <Button text="Create" type="primary" onClick={handleSubmit} />
                    </div>
                </form>
            </div>
        </DialogProvider>
    );
};