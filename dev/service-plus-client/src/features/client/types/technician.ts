export type TechnicianType = {
    id:             number;
    branch_id:      number;
    branch_name:    string | null;
    code:           string;
    name:           string;
    phone:          string | null;
    email:          string | null;
    specialization: string | null;
    leaving_date:   string | null;
    is_active:      boolean;
};

export type BranchOption = {
    id:             number;
    code:           string;
    name:           string;
    is_head_office: boolean;
};
