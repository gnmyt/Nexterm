import * as mdiIcons from "@mdi/js";

export const getIconPath = (iconName) => 
    (iconName && mdiIcons[iconName]) || mdiIcons.mdiServerOutline;
