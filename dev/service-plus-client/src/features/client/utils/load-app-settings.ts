import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import type { AppDispatch } from "@/store";
import {
	setDefaultGstRate,
	setDefaultHsnForServiceCharge,
	setDefaultHsnForSparePart,
	setExtendedWarrantyEnabled,
	setJobTermsAndConditions,
	setMarkupPercentOverCost,
	setNoOfJobInvoicesPerPrint,
	setNoOfJobReceiptsPerPrint,
	setNoOfJobSheetsPerPrint,
	setPostDataToAccounts,
	setTrackJobUrl,
} from "@/store/context-slice";

/**
 * Loads the tenant's app settings into the context slice. Runs when a BU is opened and again after
 * any settings edit, so a changed setting is visible without a re-login.
 */
export function loadAppSettings(dispatch: AppDispatch, dbName: string, schema: string): Promise<void> {
	return apolloClient
		.query<{ genericQuery: { setting_key: string; setting_value: unknown }[] }>({
			fetchPolicy: "network-only",
			query: GRAPHQL_MAP.genericQuery,
			variables: {
				db_name: dbName,
				schema,
				value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_APP_SETTINGS }),
			},
		})
		.then((res) => {
			const settings = res.data?.genericQuery ?? [];
			const rawGst = settings.find((s) => s.setting_key === "default_gst_rate")?.setting_value;
			let parsedGst: unknown = rawGst;
			if (typeof rawGst === "string") {
				try {
					parsedGst = JSON.parse(rawGst);
				} catch {
					/* keep raw */
				}
			}
			dispatch(setDefaultGstRate(Number(parsedGst ?? 0)));

			const rawMarkup = settings.find((s) => s.setting_key === "markup_percent_over_cost")?.setting_value;
			let parsedMarkup: unknown = rawMarkup;
			if (typeof rawMarkup === "string") {
				try {
					parsedMarkup = JSON.parse(rawMarkup);
				} catch {
					/* keep raw */
				}
			}
			dispatch(setMarkupPercentOverCost(Number(parsedMarkup ?? 20)));

			const rawHsn = settings.find((s) => s.setting_key === "default_hsn_for_spare_part")?.setting_value;
			let parsedHsn: unknown = rawHsn;
			if (typeof rawHsn === "string") {
				try {
					parsedHsn = JSON.parse(rawHsn);
				} catch {
					/* keep raw */
				}
			}
			dispatch(setDefaultHsnForSparePart(String(parsedHsn ?? "")));

			const rawSvcHsn = settings.find((s) => s.setting_key === "default_hsn_for_service_charge")?.setting_value;
			let parsedSvcHsn: unknown = rawSvcHsn;
			if (typeof rawSvcHsn === "string") {
				try {
					parsedSvcHsn = JSON.parse(rawSvcHsn);
				} catch {
					/* keep raw */
				}
			}
			dispatch(setDefaultHsnForServiceCharge(String(parsedSvcHsn ?? "")));

			const rawCopies = settings.find((s) => s.setting_key === "no_of_job_sheets_per_print")?.setting_value;
			let parsedCopies: unknown = rawCopies;
			if (typeof rawCopies === "string") {
				try {
					parsedCopies = JSON.parse(rawCopies);
				} catch {
					/* keep raw */
				}
			}
			dispatch(setNoOfJobSheetsPerPrint(Math.max(1, Number(parsedCopies ?? 1))));

			const rawInvCopies = settings.find((s) => s.setting_key === "no_of_job_invoices_per_print")?.setting_value;
			let parsedInvCopies: unknown = rawInvCopies;
			if (typeof rawInvCopies === "string") {
				try {
					parsedInvCopies = JSON.parse(rawInvCopies);
				} catch {
					/* keep raw */
				}
			}
			dispatch(setNoOfJobInvoicesPerPrint(Math.max(1, Number(parsedInvCopies ?? 1))));

			const rawRcptCopies = settings.find((s) => s.setting_key === "no_of_job_receipts_per_print")?.setting_value;
			let parsedRcptCopies: unknown = rawRcptCopies;
			if (typeof rawRcptCopies === "string") {
				try {
					parsedRcptCopies = JSON.parse(rawRcptCopies);
				} catch {
					/* keep raw */
				}
			}
			dispatch(setNoOfJobReceiptsPerPrint(Math.max(1, Number(parsedRcptCopies ?? 1))));

			const rawPost = settings.find((s) => s.setting_key === "post_data_to_accounts")?.setting_value;
			let parsedPost: unknown = rawPost;
			if (typeof rawPost === "string") {
				try {
					parsedPost = JSON.parse(rawPost);
				} catch {
					/* keep raw */
				}
			}
			dispatch(setPostDataToAccounts(parsedPost === true || parsedPost === "true"));

			const rawTrackUrl = settings.find((s) => s.setting_key === "track_job_url")?.setting_value;
			let parsedTrackUrl: unknown = rawTrackUrl;
			if (typeof rawTrackUrl === "string") {
				try {
					parsedTrackUrl = JSON.parse(rawTrackUrl);
				} catch {
					/* keep raw */
				}
			}
			dispatch(setTrackJobUrl(parsedTrackUrl != null ? String(parsedTrackUrl) : null));

			const rawTerms = settings.find((s) => s.setting_key === "job_terms_and_conditions")?.setting_value;
			let parsedTerms: unknown = rawTerms;
			if (typeof rawTerms === "string") {
				try {
					parsedTerms = JSON.parse(rawTerms);
				} catch {
					/* keep raw */
				}
			}
			dispatch(setJobTermsAndConditions(parsedTerms != null ? String(parsedTerms) : ""));

			// extended_warranty is a JSON object; only `enabled === true` shows the add-on —
			// the same strict rule as the server's is_ew_enabled, so a missing row, a
			// partial object or the string "true" all read as off.
			const rawEw = settings.find((s) => s.setting_key === "extended_warranty")?.setting_value;
			let parsedEw: unknown = rawEw;
			if (typeof rawEw === "string") {
				try {
					parsedEw = JSON.parse(rawEw);
				} catch {
					/* keep raw */
				}
			}
			dispatch(
				setExtendedWarrantyEnabled(
					!!parsedEw && typeof parsedEw === "object" && (parsedEw as { enabled?: unknown }).enabled === true,
				),
			);
		})
		.catch(() => {
			/* silently ignore */
		});
}
