import "./styles.sass";
import { DialogProvider } from "@/common/components/Dialog";
import Button from "@/common/components/Button";

export const ActionConfirmDialog = ({open, setOpen, onConfirm, onCancel, text}) => {

    const cancel = () => {
        setOpen(false);

        if (onCancel) {
            onCancel();
        }
    }

    const confirm = () => {
        setOpen(false);

        if (onConfirm) {
            onConfirm();
        }
    }

    return (
        <DialogProvider onClose={() => setOpen(false)} open={open}>
            <div className="confirm-dialog">
                <h2>Are you sure?</h2>
                <p>{text ? text : "This action cannot be undone."}</p>
                <div className="btn-area">
                    <Button onClick={cancel} type="secondary" text="Cancel" />
                    <Button onClick={confirm} type="primary" text="Confirm" />
                </div>
            </div>
        </DialogProvider>
    )
}