export const ROUTES = {
    home:          '/',
    login:         '/login',
    resetPassword: '/reset-password',
    client: {
        configurations: '/client/configurations',
        inventory:      '/client/inventory',
        jobs:           '/client/jobs',
        masters:        '/client/masters',
        reports:        '/client/reports',
        root:           '/client',
    },
    admin: {
        audit:         '/admin/audit',
        businessUnits: '/admin/business-units',
        roles:         '/admin/roles',
        root:          '/admin',
        settings:      '/admin/settings',
        users:         '/admin/users',
    },
    superAdmin: {
        audit:    '/super-admin/audit',
        clients:  '/super-admin/clients',
        root:     '/super-admin',
        settings: '/super-admin/settings',
        usage:    '/super-admin/usage',
    },
} as const;
