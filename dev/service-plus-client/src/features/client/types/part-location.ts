export type PartLocationType = {
    id:          number;
    branch_id:   number;
    branch_name: string | null;
    location:    string;
    is_active:   boolean;
};

export type BranchOption = {
    id:             number;
    code:           string;
    name:           string;
    is_head_office: boolean;
};
