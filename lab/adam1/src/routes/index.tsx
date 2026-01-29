import {
  createRouter,
  createRootRoute,
  createRoute,
  redirect,
  Outlet,
} from "@tanstack/react-router";
import { store } from "@/app/store";
import { MainLayout } from "@/components/layout";
import {
  Dashboard,
  ShadcnComponents,
  CustomerPortal,
  Login,
} from "@/pages";
import { CustomerDetails, ZodForm } from "@/pages/example-forms";
import {
  TicketGrid,
  TicketForm,
  TicketDetails,
  TicketFilters,
} from "@/features/tickets";

// Auth check helper
const requireAuth = () => {
  const state = store.getState();
  if (!state.auth.isAuthenticated) {
    throw redirect({ to: "/login" });
  }
};

// Redirect if already authenticated
const redirectIfAuth = () => {
  const state = store.getState();
  if (state.auth.isAuthenticated) {
    throw redirect({ to: "/dashboard" });
  }
};

// Root route
const rootRoute = createRootRoute({
  component: Outlet,
});

// Login route (public)
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  beforeLoad: redirectIfAuth,
  component: Login,
});

// Protected layout route
const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "protected",
  beforeLoad: requireAuth,
  component: MainLayout,
});

// Redirect from / to /dashboard
const indexRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});

// Dashboard route
const dashboardRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/dashboard",
  component: Dashboard,
});

// Tickets route
const ticketsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/tickets",
  component: () => (
    <div>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Tickets</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <TicketFilters />
        </div>
        <div className="lg:col-span-3">
          <TicketGrid />
        </div>
      </div>
      <TicketForm />
      <TicketDetails />
    </div>
  ),
});

// Shadcn Components route
const componentsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/components",
  component: ShadcnComponents,
});

// Example Forms routes
const customerDetailsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/example-forms/customer-details",
  component: CustomerDetails,
});

const zodFormRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/example-forms/zod-form",
  component: ZodForm,
});

// Customer Portal route
const customerPortalRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/customer-portal",
  component: CustomerPortal,
});

// Route tree
const routeTree = rootRoute.addChildren([
  loginRoute,
  protectedRoute.addChildren([
    indexRoute,
    dashboardRoute,
    ticketsRoute,
    componentsRoute,
    customerDetailsRoute,
    zodFormRoute,
    customerPortalRoute,
  ]),
]);

// Create router
export const router = createRouter({ routeTree });

// Type declaration for router
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
