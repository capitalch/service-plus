export type StaffRoleType = {
	code: string;
	id: number;
	name: string;
};

export type StaffUserType = {
	created_at: string;
	email: string;
	full_name: string;
	id: number;
	is_active: boolean;
	mobile: string | null;
	role_code: string;
	role_name: string;
	username: string;
};
