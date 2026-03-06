import type { SqlObjectType } from "@/lib/graphql-utils";

export type SeedBatchType = {
	label: string;
	sqlObject: SqlObjectType;
};

export const SEED_BATCHES: SeedBatchType[] = [
	{
		label: "Roles",
		sqlObject: {
			tableName: "role",
			xData: [
				{ code: "MANAGER",      description: "Manage orders, customers, reports",      id: 1, isIdInsert: true, is_system: true, name: "Manager" },
				{ code: "TECHNICIAN",   description: "Manage service orders and update status", id: 2, isIdInsert: true, is_system: true, name: "Technician" },
				{ code: "RECEPTIONIST", description: "Create orders, view customers",           id: 3, isIdInsert: true, is_system: true, name: "Receptionist" },
			],
		},
	},
	// Add more seed batches here as needed, e.g.:
	// { label: "Access Rights", sqlObject: { tableName: "access_right", xData: [...] } },
];
