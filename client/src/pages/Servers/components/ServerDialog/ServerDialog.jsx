import { DialogProvider } from "@/common/components/Dialog";
import "./styles.sass";

export const ServerDialog = ({open, onClose}) => {
    return (
        <DialogProvider open={open} onClose={onClose}>
        </DialogProvider>
    )
}