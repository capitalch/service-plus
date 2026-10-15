// Optional features the Super Admin switches on per BU (security.bu.features). A feature that
// is off for a BU is hidden from its users, and the server refuses its writes.
// Mirror of service-plus-server/app/core/bu_features.py — add a feature to both.
export const BU_FEATURES = {
	SPARE_PARTS_WEB: "spare_parts_web",
} as const;

export type BuFeatureType = (typeof BU_FEATURES)[keyof typeof BU_FEATURES];

export type BuFeatureInfoType = {
	description: string;
	key: BuFeatureType;
	label: string;
};

// Shown in the Super Admin's Features dialog, in this order.
export const BU_FEATURE_LIST: BuFeatureInfoType[] = [
	{
		description: "Public parts catalogue and order requests",
		key: BU_FEATURES.SPARE_PARTS_WEB,
		label: "Spare Parts Web",
	},
];
