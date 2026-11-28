import Icon from "@mdi/react";
import { useIconPath } from "@/common/utils/iconUtils.js";

export const EntryIcon = ({ name, ...props }) => <Icon path={useIconPath(name)} {...props} />;

export default EntryIcon;
