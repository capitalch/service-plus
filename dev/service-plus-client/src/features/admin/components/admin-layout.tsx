import { useEffect } from "react";
import type { ReactNode } from "react";
import {
	BriefcaseIcon,
	BuildingIcon,
	CreditCardIcon,
	InboxIcon,
	ListChecksIcon,
	LogOutIcon,
	ScrollTextIcon,
	ShieldCheckIcon,
	UsersIcon,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";

import { NotificationBell } from "@/components/shared/notifications/notification-bell";
import type { NotificationItem } from "@/components/shared/notifications/notification-bell";
import { useEnquiryCount } from "@/components/shared/enquiries/use-enquiry-count";
import { Button } from "@/components/ui/button";
import { SQL_MAP } from "@/constants/sql-map";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
	logout,
	selectCurrentUser,
	selectDbName,
	selectIsDefaultCustomerDb,
	setSessionMode,
} from "@/features/auth/store/auth-slice";
import { clearContext } from "@/store/context-slice";
import { ROUTES } from "@/router/routes";

type AdminLayoutPropsType = {
	children: ReactNode;
};

const NAV_ITEMS = [
	{ icon: ShieldCheckIcon, label: "Dashboard", to: ROUTES.admin.root },
	{ icon: UsersIcon, label: "Business Users", to: ROUTES.admin.users },
	{ icon: BuildingIcon, label: "Business Units", to: ROUTES.admin.businessUnits },
	{ icon: ListChecksIcon, label: "Roles", to: ROUTES.admin.roles },
	{ icon: ScrollTextIcon, label: "Audit Logs", to: ROUTES.admin.audit },
];

// Only the default customer database's admin approves portal sign-ups (plans/plan.md Step 9).
const ENQUIRIES_NAV_ITEM = { icon: InboxIcon, label: "Enquiries", to: ROUTES.admin.enquiries };
// ...and records their monthly payments and plan changes (plans/plan.md Step 14).
const SUBSCRIPTIONS_NAV_ITEM = { icon: CreditCardIcon, label: "Subscriptions", to: ROUTES.admin.subscriptions };

export const AdminLayout = ({ children }: AdminLayoutPropsType) => {
	const dispatch = useAppDispatch();
	const navigate = useNavigate();
	const user = useAppSelector(selectCurrentUser);
	const dbName = useAppSelector(selectDbName);
	const isDefaultCustomerDb = useAppSelector(selectIsDefaultCustomerDb);
	const navItems = isDefaultCustomerDb
		? [...NAV_ITEMS.slice(0, 1), ENQUIRIES_NAV_ITEM, SUBSCRIPTIONS_NAV_ITEM, ...NAV_ITEMS.slice(1)]
		: NAV_ITEMS;
	const { count: pendingEnquiries } = useEnquiryCount({
		dbName,
		enabled: isDefaultCustomerDb,
		schema: "security",
		sqlId: SQL_MAP.GET_SALES_ENQUIRY_PENDING_COUNT,
	});
	const notificationItems: NotificationItem[] = [
		{
			count: pendingEnquiries,
			icon: InboxIcon,
			id: "pending-enquiries",
			label: "Pending sign-ups",
			onSelect: () => navigate(ROUTES.admin.enquiries),
		},
	];

	useEffect(() => {
		document.documentElement.classList.remove("dark");
	}, []);

	function handleLogout() {
		dispatch(logout());
		dispatch(clearContext());
		navigate(ROUTES.login);
	}

	function handleSwitchToClient() {
		dispatch(setSessionMode("client"));
		navigate(ROUTES.home);
	}

	return (
		<div className="flex h-screen w-full overflow-hidden bg-slate-50">
			{/* Sidebar */}
			<aside className="hidden w-56 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
				{/* Logo */}
				<div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
					<div className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-600">
						<span className="text-xs font-bold text-white">S+</span>
					</div>
					<span className="text-sm font-semibold text-slate-800">Admin Panel</span>
				</div>

				{/* Nav */}
				<nav className="flex flex-1 flex-col gap-1 p-3">
					{navItems.map(({ icon: Icon, label, to }) => (
						<NavLink
							className={({ isActive }) =>
								`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
									isActive
										? "bg-teal-50 font-medium text-teal-700"
										: "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
								}`
							}
							end
							key={to}
							to={to}
						>
							<Icon className="h-4 w-4 shrink-0" />
							{label}
						</NavLink>
					))}
				</nav>

				{/* Footer actions */}
				<div className="flex flex-col gap-2 border-t border-slate-100 p-3">
					<Button
						className="w-full justify-start gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
						onClick={handleSwitchToClient}
						size="sm"
						variant="outline"
					>
						<BriefcaseIcon className="h-3.5 w-3.5 text-purple-600" />
						Switch to Client Mode
					</Button>
				</div>
			</aside>

			{/* Main area */}
			<div className="flex flex-1 flex-col overflow-hidden">
				{/* Top bar */}
				<header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
					<div className="flex items-center gap-2 lg:hidden">
						<div className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-600">
							<span className="text-xs font-bold text-white">S+</span>
						</div>
						<span className="text-sm font-semibold text-slate-800">Admin Panel</span>
					</div>
					<div className="flex flex-1" />
					<div className="flex items-center gap-3">
						{isDefaultCustomerDb && (
							<NotificationBell className="hover:bg-slate-100" items={notificationItems} />
						)}
						<div className="text-right leading-tight">
							<p className="text-xs font-semibold text-slate-600">{user?.fullName ?? user?.username}</p>
							<p className="text-[10px] font-bold uppercase tracking-widest text-teal-600">
								{user?.userType === "S" ? "Super Admin" : "Admin"}
							</p>
						</div>
						<Button
							className="h-7 gap-1.5 border-indigo-200 px-2.5 text-xs text-indigo-700 hover:bg-indigo-50 lg:hidden"
							onClick={handleSwitchToClient}
							size="sm"
							variant="outline"
						>
							<BriefcaseIcon className="h-3 w-3 text-purple-600" />
							Client Mode
						</Button>
						<button
							className="rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
							title="Logout"
							onClick={handleLogout}
						>
							<LogOutIcon className="h-4 w-4 text-muted-foreground" />
						</button>
					</div>
				</header>

				<main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
			</div>
		</div>
	);
};
