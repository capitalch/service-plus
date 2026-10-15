"""Optional features the Super Admin switches on per BU (security.bu.features).

A feature that is off for a BU is hidden from its users and its writes are refused
(auth_guards.require_bu_feature). Mirror of service-plus-client/src/constants/bu-features.ts —
add a feature to both.
"""

SPARE_PARTS_WEB = "spare_parts_web"

# name -> what the Super Admin sees in the Features dialog
BU_FEATURES: dict[str, str] = {
    SPARE_PARTS_WEB: "Spare Parts Web — public parts catalogue and order requests",
}
