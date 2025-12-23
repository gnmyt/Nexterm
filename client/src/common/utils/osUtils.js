export const OS_OPTIONS = [
    { value: 'Ubuntu', label: 'Ubuntu' },
    { value: 'Debian', label: 'Debian' },
    { value: 'Alpine Linux', label: 'Alpine Linux' },
    { value: 'Fedora', label: 'Fedora' },
    { value: 'CentOS', label: 'CentOS' },
    { value: 'Red Hat', label: 'Red Hat' },
    { value: 'Rocky Linux', label: 'Rocky Linux' },
    { value: 'AlmaLinux', label: 'AlmaLinux' },
    { value: 'openSUSE', label: 'openSUSE' },
    { value: 'Arch Linux', label: 'Arch Linux' },
    { value: 'Manjaro', label: 'Manjaro' },
    { value: 'Gentoo', label: 'Gentoo' },
    { value: 'NixOS', label: 'NixOS' },
    { value: 'Proxmox VE', label: 'Proxmox VE' },
];

export const parseOsFilter = (osFilter) => {
    if (!osFilter) return [];
    if (Array.isArray(osFilter)) return osFilter;
    if (typeof osFilter === 'string') {
        try { return JSON.parse(osFilter); } catch { return []; }
    }
    return [];
};

export const normalizeOsName = (osName) => {
    if (!osName) return null;
    const lower = osName.toLowerCase();
    const mappings = [
        ['ubuntu', 'Ubuntu'], ['debian', 'Debian'], ['alpine', 'Alpine Linux'],
        ['fedora', 'Fedora'], ['centos', 'CentOS'], ['red hat', 'Red Hat'], ['rhel', 'Red Hat'],
        ['rocky', 'Rocky Linux'], ['alma', 'AlmaLinux'], ['opensuse', 'openSUSE'], ['suse', 'openSUSE'],
        ['arch', 'Arch Linux'], ['manjaro', 'Manjaro'], ['gentoo', 'Gentoo'],
        ['nixos', 'NixOS'], ['proxmox', 'Proxmox VE'],
    ];
    for (const [key, value] of mappings) {
        if (lower.includes(key)) return value;
    }
    return osName;
};
