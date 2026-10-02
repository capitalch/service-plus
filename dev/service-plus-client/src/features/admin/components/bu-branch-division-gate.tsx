import { LogOutIcon, ShieldCheckIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MESSAGES } from "@/constants/messages";
import { logout, selectCurrentUser, setSessionMode } from "@/features/auth/store/auth-slice";
import { useBuBranchDivisionActions } from "@/features/admin/hooks/use-bu-branch-division-actions";
import { ROUTES } from "@/router/routes";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearContext, selectIsBuBranchDivisionComplete, selectIsResolvingContext } from "@/store/context-slice";

// ─── Component ────────────────────────────────────────────────────────────────
// Blocking, non-dismissible modal that forces BU/Branch/Division selection
// before the user can interact with the rest of the app. Reuses the same
// fetch/handler logic as the compact nav switcher (BuBranchSwitcher) via
// useBuBranchDivisionActions — it never calls initContext itself, so whichever
// layout's BuBranchSwitcher instance already owns the one-time auto-init.

export const BuBranchDivisionGate = () => {
	const dispatch = useAppDispatch();
	const navigate = useNavigate();
	const isResolving = useAppSelector(selectIsResolvingContext);
	const isComplete = useAppSelector(selectIsBuBranchDivisionComplete);
	const user = useAppSelector(selectCurrentUser);
	const {
		availableBus,
		availableBranches,
		availableDivisions,
		currentBu,
		currentBranch,
		currentDivision,
		handleBuChange,
		handleBranchChange,
		handleDivisionChange,
	} = useBuBranchDivisionActions();

	const open = !isResolving && !isComplete;
	const hasNoBu = availableBus.length === 0;
	// An admin's BU list is every BU in the tenant (GET_ALL_BUS_WITH_SCHEMA_STATUS), so an
	// empty list means none exists yet — a fresh tenant. Admin mode is where the first one is
	// created, and this dialog covers the activity bar's own switch, so offer it here.
	const isAdmin = user?.userType === "A";

	function handleGoToAdmin() {
		dispatch(setSessionMode("admin"));
		navigate(ROUTES.admin.businessUnits);
	}

	function handleLogout() {
		dispatch(logout());
		dispatch(clearContext());
		navigate(ROUTES.login);
	}

	return (
		<AlertDialog open={open}>
			{/* Radix's AlertDialogContent already blocks outside-click/pointer-down dismissal
                unconditionally (those handlers aren't even exposed as props) — only Escape
                needs to be explicitly suppressed here. */}
			<AlertDialogContent className="max-w-sm" onEscapeKeyDown={(e: KeyboardEvent) => e.preventDefault()}>
				<AlertDialogHeader>
					<AlertDialogTitle>Select Business Unit, Branch &amp; Division</AlertDialogTitle>
					<AlertDialogDescription>
						{hasNoBu
							? isAdmin
								? MESSAGES.INFO_NO_BU_CREATED_ADMIN
								: MESSAGES.INFO_NO_BU_ASSIGNED_USER
							: MESSAGES.INFO_SELECT_BU_BRANCH_DIVISION}
					</AlertDialogDescription>
				</AlertDialogHeader>

				{hasNoBu ? (
					<div className="flex flex-col gap-2">
						{isAdmin && (
							<Button className="gap-2 w-full" onClick={handleGoToAdmin}>
								<ShieldCheckIcon className="h-4 w-4" />
								Go to Admin Mode
							</Button>
						)}
						<Button className="gap-2 w-full" onClick={handleLogout} variant="outline">
							<LogOutIcon className="h-4 w-4 text-muted-foreground" />
							Logout
						</Button>
					</div>
				) : (
					<div className="flex flex-col gap-3">
						<div className="flex flex-col gap-1.5">
							<label className="text-xs font-medium text-muted-foreground">Business Unit</label>
							<Select onValueChange={handleBuChange} value={currentBu ? String(currentBu.id) : undefined}>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Select business unit" />
								</SelectTrigger>
								<SelectContent>
									{availableBus.map((bu) => (
										<SelectItem key={bu.id} value={String(bu.id)}>
											{bu.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="flex flex-col gap-1.5">
							<label className="text-xs font-medium text-muted-foreground">Branch</label>
							<Select
								disabled={!currentBu || availableBranches.length === 0}
								onValueChange={handleBranchChange}
								value={currentBranch ? String(currentBranch.id) : undefined}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Select branch" />
								</SelectTrigger>
								<SelectContent>
									{availableBranches.map((branch) => (
										<SelectItem key={branch.id} value={String(branch.id)}>
											{branch.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{availableDivisions.length > 0 && (
							<div className="flex flex-col gap-1.5">
								<label className="text-xs font-medium text-muted-foreground">Division</label>
								<Select
									disabled={!currentBranch}
									onValueChange={handleDivisionChange}
									value={currentDivision ? String(currentDivision.id) : undefined}
								>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Select division" />
									</SelectTrigger>
									<SelectContent>
										{availableDivisions.map((d) => (
											<SelectItem key={d.id} value={String(d.id)}>
												{d.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						)}
					</div>
				)}
			</AlertDialogContent>
		</AlertDialog>
	);
};
