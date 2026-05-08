export type TransitionFields = "none" | "R" | "RT" | "RA" | "RE";

export type Transition = {
    targetId:   number;
    targetCode: string;
    targetName: string;
    fields:     TransitionFields;
};

export type StatusFlags = { is_final: boolean; is_closed: boolean };

export const STATUS_FLAGS: Record<number, StatusFlags> = {
    1:  { is_final: false, is_closed: false }, // RECEIVED
    2:  { is_final: false, is_closed: false }, // ASSIGNED
    3:  { is_final: false, is_closed: false }, // ESTIMATED
    4:  { is_final: false, is_closed: false }, // ESTIMATE_APPROVED
    5:  { is_final: false, is_closed: false }, // ESTIMATE_REJECTED
    6:  { is_final: false, is_closed: false }, // IN_PROGRESS
    7:  { is_final: false, is_closed: false }, // PARTS_PENDING
    8:  { is_final: false, is_closed: false }, // ON_HOLD
    9:  { is_final: false, is_closed: false }, // OUTSOURCED
    10: { is_final: false, is_closed: false }, // SENT_TO_COMPANY
    11: { is_final: false, is_closed: false }, // COMPLETED_OK
    12: { is_final: false, is_closed: false }, // RETURN
    13: { is_final: false, is_closed: false }, // DELIVERED_OK
    14: { is_final: false, is_closed: false }, // DELIVERED_NOT_OK
    15: { is_final: true,  is_closed: true  }, // CANCELLED
    16: { is_final: true,  is_closed: true  }, // DISPOSED
};

export const TRANSITIONS: Record<number, Transition[]> = {
    // RECEIVED
    1: [
        { targetId: 2,  targetCode: "ASSIGNED",         targetName: "Assigned",         fields: "RT" },
        { targetId: 3,  targetCode: "ESTIMATED",        targetName: "Estimated",        fields: "RE" },
        { targetId: 6,  targetCode: "IN_PROGRESS",      targetName: "In Progress",      fields: "none" },
        { targetId: 7,  targetCode: "PARTS_PENDING",    targetName: "Parts Pending",    fields: "R" },
        { targetId: 8,  targetCode: "ON_HOLD",          targetName: "On Hold",          fields: "R" },
        { targetId: 9,  targetCode: "OUTSOURCED",       targetName: "Outsourced",       fields: "R" },
        { targetId: 10, targetCode: "SENT_TO_COMPANY",  targetName: "Sent to Company",  fields: "R" },
        { targetId: 11, targetCode: "COMPLETED_OK",     targetName: "Completed OK",     fields: "R" },
        { targetId: 12, targetCode: "RETURN",           targetName: "Return",           fields: "R" },
        { targetId: 15, targetCode: "CANCELLED",        targetName: "Cancelled",        fields: "R" },
        { targetId: 16, targetCode: "DISPOSED",         targetName: "Disposed",         fields: "R" },
    ],
    // ASSIGNED
    2: [
        { targetId: 3,  targetCode: "ESTIMATED",        targetName: "Estimated",        fields: "RE" },
        { targetId: 6,  targetCode: "IN_PROGRESS",      targetName: "In Progress",      fields: "none" },
        { targetId: 7,  targetCode: "PARTS_PENDING",    targetName: "Parts Pending",    fields: "R" },
        { targetId: 8,  targetCode: "ON_HOLD",          targetName: "On Hold",          fields: "R" },
        { targetId: 9,  targetCode: "OUTSOURCED",       targetName: "Outsourced",       fields: "R" },
        { targetId: 10, targetCode: "SENT_TO_COMPANY",  targetName: "Sent to Company",  fields: "R" },
        { targetId: 11, targetCode: "COMPLETED_OK",     targetName: "Completed OK",     fields: "R" },
        { targetId: 12, targetCode: "RETURN",           targetName: "Return",           fields: "R" },
        { targetId: 15, targetCode: "CANCELLED",        targetName: "Cancelled",        fields: "R" },
        { targetId: 16, targetCode: "DISPOSED",         targetName: "Disposed",         fields: "R" },
    ],
    // ESTIMATED
    3: [
        { targetId: 4,  targetCode: "ESTIMATE_APPROVED", targetName: "Estimate Approved", fields: "R" },
        { targetId: 5,  targetCode: "ESTIMATE_REJECTED", targetName: "Estimate Rejected", fields: "R" },
        { targetId: 3,  targetCode: "ESTIMATED",         targetName: "Re-Estimate",       fields: "RE" },
        { targetId: 7,  targetCode: "PARTS_PENDING",     targetName: "Parts Pending",     fields: "R" },
        { targetId: 8,  targetCode: "ON_HOLD",           targetName: "On Hold",           fields: "R" },
        { targetId: 10, targetCode: "SENT_TO_COMPANY",   targetName: "Sent to Company",   fields: "R" },
        { targetId: 11, targetCode: "COMPLETED_OK",      targetName: "Completed OK",      fields: "R" },
        { targetId: 12, targetCode: "RETURN",            targetName: "Return",            fields: "R" },
        { targetId: 15, targetCode: "CANCELLED",         targetName: "Cancelled",         fields: "R" },
        { targetId: 16, targetCode: "DISPOSED",          targetName: "Disposed",          fields: "R" },
    ],
    // ESTIMATE_APPROVED
    4: [
        { targetId: 6,  targetCode: "IN_PROGRESS",      targetName: "In Progress",      fields: "none" },
        { targetId: 7,  targetCode: "PARTS_PENDING",    targetName: "Parts Pending",    fields: "R" },
        { targetId: 8,  targetCode: "ON_HOLD",          targetName: "On Hold",          fields: "R" },
        { targetId: 9,  targetCode: "OUTSOURCED",       targetName: "Outsourced",       fields: "R" },
        { targetId: 10, targetCode: "SENT_TO_COMPANY",  targetName: "Sent to Company",  fields: "R" },
        { targetId: 11, targetCode: "COMPLETED_OK",     targetName: "Completed OK",     fields: "RA" },
        { targetId: 12, targetCode: "RETURN",           targetName: "Return",           fields: "RA" },
        { targetId: 5,  targetCode: "ESTIMATE_REJECTED", targetName: "Estimate Rejected", fields: "R" },
        { targetId: 15, targetCode: "CANCELLED",        targetName: "Cancelled",        fields: "R" },
        { targetId: 16, targetCode: "DISPOSED",         targetName: "Disposed",         fields: "R" },
    ],
    // ESTIMATE_REJECTED
    5: [
        { targetId: 3,  targetCode: "ESTIMATED",        targetName: "Re-Estimate",      fields: "RE" },
        { targetId: 12, targetCode: "RETURN",           targetName: "Return",           fields: "R" },
        { targetId: 15, targetCode: "CANCELLED",        targetName: "Cancelled",        fields: "R" },
        { targetId: 16, targetCode: "DISPOSED",         targetName: "Disposed",         fields: "R" },
    ],
    // IN_PROGRESS
    6: [
        { targetId: 7,  targetCode: "PARTS_PENDING",    targetName: "Parts Pending",    fields: "R" },
        { targetId: 8,  targetCode: "ON_HOLD",          targetName: "On Hold",          fields: "R" },
        { targetId: 9,  targetCode: "OUTSOURCED",       targetName: "Outsourced",       fields: "R" },
        { targetId: 10, targetCode: "SENT_TO_COMPANY",  targetName: "Sent to Company",  fields: "R" },
        { targetId: 11, targetCode: "COMPLETED_OK",     targetName: "Completed OK",     fields: "RA" },
        { targetId: 12, targetCode: "RETURN",           targetName: "Return",           fields: "RA" },
        { targetId: 15, targetCode: "CANCELLED",        targetName: "Cancelled",        fields: "R" },
        { targetId: 16, targetCode: "DISPOSED",         targetName: "Disposed",         fields: "R" },
    ],
    // PARTS_PENDING
    7: [
        { targetId: 6,  targetCode: "IN_PROGRESS",      targetName: "In Progress",      fields: "none" },
        { targetId: 8,  targetCode: "ON_HOLD",          targetName: "On Hold",          fields: "R" },
        { targetId: 9,  targetCode: "OUTSOURCED",       targetName: "Outsourced",       fields: "R" },
        { targetId: 10, targetCode: "SENT_TO_COMPANY",  targetName: "Sent to Company",  fields: "R" },
        { targetId: 11, targetCode: "COMPLETED_OK",     targetName: "Completed OK",     fields: "RA" },
        { targetId: 12, targetCode: "RETURN",           targetName: "Return",           fields: "RA" },
        { targetId: 15, targetCode: "CANCELLED",        targetName: "Cancelled",        fields: "R" },
        { targetId: 16, targetCode: "DISPOSED",         targetName: "Disposed",         fields: "R" },
    ],
    // ON_HOLD
    8: [
        { targetId: 6,  targetCode: "IN_PROGRESS",      targetName: "In Progress",      fields: "none" },
        { targetId: 7,  targetCode: "PARTS_PENDING",    targetName: "Parts Pending",    fields: "R" },
        { targetId: 9,  targetCode: "OUTSOURCED",       targetName: "Outsourced",       fields: "R" },
        { targetId: 10, targetCode: "SENT_TO_COMPANY",  targetName: "Sent to Company",  fields: "R" },
        { targetId: 11, targetCode: "COMPLETED_OK",     targetName: "Completed OK",     fields: "RA" },
        { targetId: 12, targetCode: "RETURN",           targetName: "Return",           fields: "RA" },
        { targetId: 15, targetCode: "CANCELLED",        targetName: "Cancelled",        fields: "R" },
        { targetId: 16, targetCode: "DISPOSED",         targetName: "Disposed",         fields: "R" },
    ],
    // OUTSOURCED
    9: [
        { targetId: 6,  targetCode: "IN_PROGRESS",      targetName: "In Progress",      fields: "none" },
        { targetId: 7,  targetCode: "PARTS_PENDING",    targetName: "Parts Pending",    fields: "R" },
        { targetId: 8,  targetCode: "ON_HOLD",          targetName: "On Hold",          fields: "R" },
        { targetId: 11, targetCode: "COMPLETED_OK",     targetName: "Completed OK",     fields: "RA" },
        { targetId: 12, targetCode: "RETURN",           targetName: "Return",           fields: "RA" },
        { targetId: 15, targetCode: "CANCELLED",        targetName: "Cancelled",        fields: "R" },
        { targetId: 16, targetCode: "DISPOSED",         targetName: "Disposed",         fields: "R" },
    ],
    // SENT_TO_COMPANY
    10: [
        { targetId: 6,  targetCode: "IN_PROGRESS",      targetName: "In Progress",      fields: "none" },
        { targetId: 11, targetCode: "COMPLETED_OK",     targetName: "Completed OK",     fields: "RA" },
        { targetId: 12, targetCode: "RETURN",           targetName: "Return",           fields: "RA" },
        { targetId: 15, targetCode: "CANCELLED",        targetName: "Cancelled",        fields: "R" },
        { targetId: 16, targetCode: "DISPOSED",         targetName: "Disposed",         fields: "R" },
    ],
    // COMPLETED_OK
    11: [
        { targetId: 13, targetCode: "DELIVERED_OK",     targetName: "Delivered OK",     fields: "RA" },
        { targetId: 14, targetCode: "DELIVERED_NOT_OK", targetName: "Delivered Not OK", fields: "R" },
        { targetId: 12, targetCode: "RETURN",           targetName: "Return",           fields: "R" },
        { targetId: 15, targetCode: "CANCELLED",        targetName: "Cancelled",        fields: "R" },
    ],
    // RETURN
    12: [
        { targetId: 13, targetCode: "DELIVERED_OK",     targetName: "Delivered OK",     fields: "RA" },
        { targetId: 14, targetCode: "DELIVERED_NOT_OK", targetName: "Delivered Not OK", fields: "R" },
        { targetId: 15, targetCode: "CANCELLED",        targetName: "Cancelled",        fields: "R" },
        { targetId: 16, targetCode: "DISPOSED",         targetName: "Disposed",         fields: "R" },
    ],
    // DELIVERED_OK — terminal
    13: [],
    // DELIVERED_NOT_OK
    14: [
        { targetId: 1,  targetCode: "RECEIVED",         targetName: "Re-open",          fields: "R" },
        { targetId: 15, targetCode: "CANCELLED",        targetName: "Cancelled",        fields: "R" },
        { targetId: 16, targetCode: "DISPOSED",         targetName: "Disposed",         fields: "R" },
    ],
    // CANCELLED
    15: [
        { targetId: 1,  targetCode: "RECEIVED",         targetName: "Re-open",          fields: "R" },
        { targetId: 16, targetCode: "DISPOSED",         targetName: "Disposed",         fields: "R" },
    ],
    // DISPOSED — terminal
    16: [],
};

export const STATUS_COLORS: Record<string, string> = {
    RECEIVED:          "bg-blue-500   hover:bg-blue-600   text-white",
    ASSIGNED:          "bg-indigo-500 hover:bg-indigo-600 text-white",
    ESTIMATED:         "bg-purple-500 hover:bg-purple-600 text-white",
    ESTIMATE_APPROVED: "bg-violet-500 hover:bg-violet-600 text-white",
    ESTIMATE_REJECTED: "bg-pink-500   hover:bg-pink-600   text-white",
    IN_PROGRESS:       "bg-orange-500 hover:bg-orange-600 text-white",
    PARTS_PENDING:     "bg-amber-500  hover:bg-amber-600  text-white",
    ON_HOLD:           "bg-yellow-500 hover:bg-yellow-600 text-black",
    OUTSOURCED:        "bg-teal-500   hover:bg-teal-600   text-white",
    SENT_TO_COMPANY:   "bg-cyan-600   hover:bg-cyan-700   text-white",
    COMPLETED_OK:      "bg-emerald-500 hover:bg-emerald-600 text-white",
    RETURN:            "bg-lime-600   hover:bg-lime-700   text-white",
    DELIVERED_OK:      "bg-green-600  hover:bg-green-700  text-white",
    DELIVERED_NOT_OK:  "bg-red-500    hover:bg-red-600    text-white",
    CANCELLED:         "bg-slate-400  hover:bg-slate-500  text-white",
    DISPOSED:          "bg-zinc-600   hover:bg-zinc-700   text-white",
};
