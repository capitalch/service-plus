# Instructions - Create a modern SuperAdmin dashboard page using React, TypeScript, Tailwind, and shadcn/ui
- In landing page provide a link to Super admin action page. Assume that this page is arrived after authentication
- layout.png contains the design layout view for this action page
Layout:
- Left sidebar navigation
- Top header with user avatar and logout
- Main dashboard area
Dashboard must include:

1. Statistics cards showing:
   - Total Clients
   - Active Clients
   - Inactive Clients
   - Total Admin Users
   - Active Admin Users
   - Inactive Admin Users

2. A data grid titled "Client Overview"
   Columns:
   - Client Name
   - Client Code
   - Status badge
   - Active Admin Count
   - Inactive Admin Count
   - Created Date
   - Actions dropdown (View, Edit, Disable)

3. Add Client button top-right.

4. Use:
   - shadcn Card components for stats
   - shadcn Table for grid
   - badges for status
   - dropdown menu for actions

5. Page should look like a SaaS admin console (Stripe / Supabase style).

6. Use dummy data and keep components modular.