import { gql } from "@apollo/client";

export const GRAPHQL_MAP = {
	addBranch: gql`
		mutation AddBranch($db_name: String!, $schema: String, $value: String!) {
			addBranch(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	adminDashboardStats: gql`
		query AdminDashboardStats($db_name: String!) {
			adminDashboardStats(db_name: $db_name)
		}
	`,
	auditLogs: gql`
		query AuditLogs(
			$action: String
			$actor: String
			$from_date: String
			$outcome: String
			$page: Int
			$page_size: Int
			$search: String
			$to_date: String
		) {
			auditLogs(
				action: $action
				actor: $actor
				from_date: $from_date
				outcome: $outcome
				page: $page
				page_size: $page_size
				search: $search
				to_date: $to_date
			)
		}
	`,
	auditLogStats: gql`
		query AuditLogStats($from_date: String, $to_date: String) {
			auditLogStats(from_date: $from_date, to_date: $to_date)
		}
	`,
	createAdminUser: gql`
		mutation CreateAdminUser($db_name: String!, $schema: String, $value: String!) {
			createAdminUser(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	createBuSchemaAndFeedSeedData: gql`
		mutation CreateBuSchemaAndFeedSeedData($db_name: String!, $schema: String, $value: String!) {
			createBuSchemaAndFeedSeedData(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	createClient: gql`
		mutation CreateClient($db_name: String!, $schema: String, $value: String!) {
			createClient(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	createBusinessUser: gql`
		mutation CreateBusinessUser($db_name: String!, $schema: String, $value: String!) {
			createBusinessUser(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	createServiceDb: gql`
		mutation CreateServiceDb($db_name: String!, $schema: String, $value: String!) {
			createServiceDb(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	feedBuSeedData: gql`
		mutation FeedBuSeedData($db_name: String!, $schema: String, $value: String!) {
			feedBuSeedData(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	seedSecurityData: gql`
		mutation SeedSecurityData($db_name: String!, $schema: String, $value: String!) {
			seedSecurityData(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	deleteBuSchema: gql`
		mutation DeleteBuSchema($db_name: String!, $schema: String, $value: String!) {
			deleteBuSchema(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	deleteClient: gql`
		mutation DeleteClient($db_name: String!, $schema: String, $value: String!) {
			deleteClient(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	dropDatabase: gql`
		mutation DropDatabase($db_name: String!, $schema: String, $value: String!) {
			dropDatabase(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	genericBatchQuery: gql`
		query GenericBatchQuery($db_name: String!, $items: [String!]!) {
			genericBatchQuery(db_name: $db_name, items: $items)
		}
	`,
	genericQuery: gql`
		query GenericQuery($db_name: String!, $schema: String, $value: String!) {
			genericQuery(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	genericUpdate: gql`
		mutation GenericUpdate($db_name: String!, $schema: String, $value: String!) {
			genericUpdate(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	genericUpdateScript: gql`
		mutation GenericUpdateScript($db_name: String!, $schema: String, $value: String!) {
			genericUpdateScript(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	deleteUnusedPartsByBrand: gql`
		mutation DeleteUnusedPartsByBrand($db_name: String!, $schema: String, $value: String!) {
			deleteUnusedPartsByBrand(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	importSpareParts: gql`
		mutation ImportSpareParts($db_name: String!, $schema: String, $value: String!) {
			importSpareParts(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	mailAdminCredentials: gql`
		mutation MailAdminCredentials($db_name: String!, $schema: String, $value: String!) {
			mailAdminCredentials(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	mailBusinessUserCredentials: gql`
		mutation MailBusinessUserCredentials($db_name: String!, $schema: String, $value: String!) {
			mailBusinessUserCredentials(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	setUserBuRole: gql`
		mutation SetUserBuRole($db_name: String!, $schema: String, $value: String!) {
			setUserBuRole(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	createSalesInvoice: gql`
		mutation CreateSalesInvoice($db_name: String!, $schema: String, $value: String!) {
			createSalesInvoice(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	createJobInvoice: gql`
		mutation CreateJobInvoice($db_name: String!, $schema: String, $value: String!) {
			createJobInvoice(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	regenerateJobInvoice: gql`
		mutation RegenerateJobInvoice($db_name: String!, $schema: String, $value: String!) {
			regenerateJobInvoice(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	createJobPayment: gql`
		mutation CreateJobPayment($db_name: String!, $schema: String, $value: String!) {
			createJobPayment(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	createSingleJob: gql`
		mutation CreateSingleJob($db_name: String!, $schema: String, $value: String!) {
			createSingleJob(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	createJobBatch: gql`
		mutation CreateJobBatch($db_name: String!, $schema: String, $value: String!) {
			createJobBatch(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	updateJob: gql`
		mutation UpdateJob($db_name: String!, $schema: String, $value: String!) {
			updateJob(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	updateOpeningJob: gql`
		mutation UpdateOpeningJob($db_name: String!, $schema: String, $value: String!) {
			updateOpeningJob(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	updateJobBatch: gql`
		mutation UpdateJobBatch($db_name: String!, $schema: String, $value: String!) {
			updateJobBatch(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	deleteJobBatch: gql`
		mutation DeleteJobBatch($db_name: String!, $schema: String, $value: String!) {
			deleteJobBatch(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	deliverJob: gql`
		mutation DeliverJob($db_name: String!, $schema: String, $value: String!) {
			deliverJob(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	undoJobTransaction: gql`
		mutation UndoJobTransaction($db_name: String!, $schema: String, $value: String!) {
			undoJobTransaction(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	undeliverJob: gql`
		mutation UndeliverJob($db_name: String!, $schema: String, $value: String!) {
			undeliverJob(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	accountsPosting: gql`
		mutation AccountsPosting($db_name: String!, $schema: String, $value: String!) {
			accountsPosting(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	sendWhatsappCompletion: gql`
		mutation SendWhatsappCompletion($db_name: String!, $schema: String, $value: String!) {
			sendWhatsappCompletion(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	sendWhatsappJobIntake: gql`
		mutation SendWhatsappJobIntake($db_name: String!, $schema: String, $value: String!) {
			sendWhatsappJobIntake(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	sendWhatsappJobDelivery: gql`
		mutation SendWhatsappJobDelivery($db_name: String!, $schema: String, $value: String!) {
			sendWhatsappJobDelivery(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	sendWhatsappMoneyReceipt: gql`
		mutation SendWhatsappMoneyReceipt($db_name: String!, $schema: String, $value: String!) {
			sendWhatsappMoneyReceipt(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	sendWhatsappJobInvoice: gql`
		mutation SendWhatsappJobInvoice($db_name: String!, $schema: String, $value: String!) {
			sendWhatsappJobInvoice(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	verifyJobDeliveryOtp: gql`
		mutation VerifyJobDeliveryOtp($db_name: String!, $schema: String, $value: String!) {
			verifyJobDeliveryOtp(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	getJobDeliveryOtpPending: gql`
		query GetJobDeliveryOtpPending($db_name: String!, $schema: String, $value: String!) {
			getJobDeliveryOtpPending(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	setJobDeliveryManualConfirmation: gql`
		mutation SetJobDeliveryManualConfirmation($db_name: String!, $schema: String, $value: String!) {
			setJobDeliveryManualConfirmation(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	// ── Extended Warranty — each needs CUSTOM_EXTENDED_WARRANTY on the server ──
	addEwFollowUp: gql`
		mutation AddEwFollowUp($db_name: String!, $schema: String, $value: String!) {
			addEwFollowUp(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	resendEwLeadAlert: gql`
		mutation ResendEwLeadAlert($db_name: String!, $schema: String, $value: String!) {
			resendEwLeadAlert(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	sendEwReminders: gql`
		mutation SendEwReminders($db_name: String!, $schema: String, $value: String!) {
			sendEwReminders(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	transitionEwLead: gql`
		mutation TransitionEwLead($db_name: String!, $schema: String, $value: String!) {
			transitionEwLead(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	accountsPostingProgress: gql`
		subscription AccountsPostingProgress($db_name: String!, $branchId: String!) {
			accountsPostingProgress(db_name: $db_name, branchId: $branchId)
		}
	`,
	whatsappDeliveryStatus: gql`
		subscription WhatsappDeliveryStatus($db_name: String!) {
			whatsappDeliveryStatus(db_name: $db_name)
		}
	`,
	superAdminClientsData: gql`
		query SuperAdminClientsData {
			superAdminClientsData
		}
	`,
	superAdminDashboardStats: gql`
		query SuperAdminDashboardStats {
			superAdminDashboardStats
		}
	`,
	systemSettings: gql`
		query SystemSettings {
			systemSettings
		}
	`,
	usageHealth: gql`
		query UsageHealth {
			usageHealth
		}
	`,
	// Plans and monthly billing (plans/plan.md Steps 12–14).
	buBillingStatus: gql`
		query BuBillingStatus($db_name: String!, $schema: String!) {
			buBillingStatus(db_name: $db_name, schema: $schema)
		}
	`,
	changeBuPlan: gql`
		mutation ChangeBuPlan($db_name: String!, $schema: String, $value: String!) {
			changeBuPlan(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	extendClientPaidThrough: gql`
		mutation ExtendClientPaidThrough($db_name: String!, $schema: String, $value: String!) {
			extendClientPaidThrough(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	recordBuSubscriptionPayment: gql`
		mutation RecordBuSubscriptionPayment($db_name: String!, $schema: String, $value: String!) {
			recordBuSubscriptionPayment(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	recordClientSubscriptionPayment: gql`
		mutation RecordClientSubscriptionPayment($db_name: String!, $schema: String, $value: String!) {
			recordClientSubscriptionPayment(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	setClientBillingHold: gql`
		mutation SetClientBillingHold($db_name: String!, $schema: String, $value: String!) {
			setClientBillingHold(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	setClientMonthlyFee: gql`
		mutation SetClientMonthlyFee($db_name: String!, $schema: String, $value: String!) {
			setClientMonthlyFee(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	startClientBilling: gql`
		mutation StartClientBilling($db_name: String!, $schema: String, $value: String!) {
			startClientBilling(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	// Sign-up enquiries (plans/plan.md Steps 9, 10).
	approveSalesEnquiry: gql`
		mutation ApproveSalesEnquiry($db_name: String!, $schema: String, $value: String!) {
			approveSalesEnquiry(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	markEnterpriseEnquiryContacted: gql`
		mutation MarkEnterpriseEnquiryContacted($db_name: String!, $schema: String, $value: String!) {
			markEnterpriseEnquiryContacted(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	markEnterpriseEnquiryPaymentFailed: gql`
		mutation MarkEnterpriseEnquiryPaymentFailed($db_name: String!, $schema: String, $value: String!) {
			markEnterpriseEnquiryPaymentFailed(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	markSalesEnquiryPaymentFailed: gql`
		mutation MarkSalesEnquiryPaymentFailed($db_name: String!, $schema: String, $value: String!) {
			markSalesEnquiryPaymentFailed(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	provisionEnterpriseEnquiry: gql`
		mutation ProvisionEnterpriseEnquiry($db_name: String!, $schema: String, $value: String!) {
			provisionEnterpriseEnquiry(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	recordEnterpriseEnquiryPayment: gql`
		mutation RecordEnterpriseEnquiryPayment($db_name: String!, $schema: String, $value: String!) {
			recordEnterpriseEnquiryPayment(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	recordSalesEnquiryPayment: gql`
		mutation RecordSalesEnquiryPayment($db_name: String!, $schema: String, $value: String!) {
			recordSalesEnquiryPayment(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	rejectEnterpriseEnquiry: gql`
		mutation RejectEnterpriseEnquiry($db_name: String!, $schema: String, $value: String!) {
			rejectEnterpriseEnquiry(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	rejectSalesEnquiry: gql`
		mutation RejectSalesEnquiry($db_name: String!, $schema: String, $value: String!) {
			rejectSalesEnquiry(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	setEnterpriseEnquiryFee: gql`
		mutation SetEnterpriseEnquiryFee($db_name: String!, $schema: String, $value: String!) {
			setEnterpriseEnquiryFee(db_name: $db_name, schema: $schema, value: $value)
		}
	`,
	salesEnquiryCount: gql`
		subscription SalesEnquiryCount($db_name: String!) {
			salesEnquiryCount(db_name: $db_name)
		}
	`,
};
