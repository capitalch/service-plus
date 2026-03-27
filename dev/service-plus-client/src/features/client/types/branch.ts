export type BranchType = {
    address_line1:  string;
    address_line2:  string | null;
    city:           string | null;
    code:           string;
    email:          string | null;
    gstin:          string | null;
    id:             number;
    is_active:      boolean;
    is_head_office: boolean;
    name:           string;
    phone:          string | null;
    pincode:        string;
    state_id:       number;
    state_name:     string | null;
};
