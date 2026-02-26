export const ROUTES = {
    home: '/',
    login: '/login',
    superAdmin: {
        root: '/super-admin',
        admins: '/super-admin/admins',
        audit: '/super-admin/audit',
        clients: '/super-admin/clients',
        settings: '/super-admin/settings',
        usage: '/super-admin/usage',
    },
} as const;
