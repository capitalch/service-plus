export type VendorType = {
    id:             number;
    name:           string;
    gstin:          string | null;
    gst_state_code: string | null;
    pan:            string | null;
    phone:          string | null;
    email:          string | null;
    address_line1:  string | null;
    address_line2:  string | null;
    city:           string | null;
    state_id:       number;
    state_name:     string | null;
    pincode:        string | null;
    is_active:      boolean;
    remarks:        string | null;
};
