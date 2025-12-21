import { 
    mdiDebian,
    mdiLinux,
    mdiMicrosoftWindows,
    mdiServerOutline,
    mdiUbuntu,
    mdiApple,
    mdiDocker,
    mdiKubernetes,
    mdiDatabase,
    mdiCloud,
    mdiRaspberryPi,
    mdiConsole,
    mdiMonitor,
    mdiCube,
    mdiFreebsd
} from "@mdi/js";

export const ICON_MAP = {
    server: mdiServerOutline,
    windows: mdiMicrosoftWindows,
    linux: mdiLinux,
    debian: mdiDebian,
    ubuntu: mdiUbuntu,
    arch: mdiLinux,
    freebsd: mdiFreebsd,
    macos: mdiApple,
    docker: mdiDocker,
    kubernetes: mdiKubernetes,
    database: mdiDatabase,
    cloud: mdiCloud,
    raspberry: mdiRaspberryPi,
    terminal: mdiConsole,
    desktop: mdiMonitor,
    vm: mdiCube,
};

export const loadIcon = (icon) => ICON_MAP[icon] || mdiServerOutline;
