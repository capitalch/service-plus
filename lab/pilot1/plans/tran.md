# create dummy pages for all side menu items
Menu items (in order):
1. Dashboard  
2. Clients
3. Admins
4. Usage & Health
5. Audit Logs
6. System Settings

Behavior:
- Clicking a menu item should set it as active.
- Decide on styling of active menu item

Return:
- One reusable `<SuperAdminSidebar />` component
- Menu items stored in a config array
- Active state handled via React state
- Clean, production-ready code