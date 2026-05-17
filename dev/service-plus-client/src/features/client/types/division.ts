export type DivisionType = {
    id:             number;
    branch_id:      number;
    code:           string;
    name:           string;
    address_line1:  string;
    address_line2:  string | null;
    city:           string | null;
    state_id:       number;
    country:        string | null;
    pincode:        string | null;
    phone:          string | null;
    email:          string | null;
    gstin:          string | null;
    gst_state_code: string | null;
    is_active:      boolean;
};

export type DivisionContextType = Pick<DivisionType,
    'id' | 'code' | 'name' | 'address_line1' | 'address_line2' |
    'city' | 'state_id' | 'country' | 'pincode' | 'phone' | 'email' |
    'gstin' | 'gst_state_code'
>;

export const isGstDivision = (d: DivisionContextType | null) => !!d?.gstin;
