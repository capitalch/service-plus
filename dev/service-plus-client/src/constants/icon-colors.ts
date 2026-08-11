/**
 * Central icon -> color mapping. Every lucide-react icon used in the app maps to
 * exactly one semantic Tailwind text-color class here, so the same icon always
 * renders in the same color everywhere it appears.
 *
 * Icons mapped to `null` (e.g. Loader2) intentionally inherit currentColor instead
 * of taking a fixed color, since they should match whatever context they spin in.
 *
 * Icons NOT present in this map fall back to "text-muted-foreground" wherever the
 * mapping is consumed.
 */

export const ICON_COLORS: Record<string, string | null> = {
	// Destructive / danger (delete, remove, disable)
	Trash2: "text-red-600",
	Trash2Icon: "text-red-600",
	XCircle: "text-red-600",
	XCircleIcon: "text-red-600",
	ShieldOff: "text-red-600",
	PackageX: "text-red-600",
	MinusCircle: "text-red-600",

	// Create / success / complete
	Plus: "text-emerald-600",
	PlusCircle: "text-emerald-600",
	Check: "text-emerald-600",
	CheckIcon: "text-emerald-600",
	CheckCircle: "text-emerald-600",
	CheckCircle2: "text-emerald-600",
	CheckCircle2Icon: "text-emerald-600",
	Save: "text-emerald-600",
	PartyPopper: "text-emerald-600",
	BookCheck: "text-emerald-600",
	ClipboardCheck: "text-emerald-600",
	ListChecksIcon: "text-emerald-600",

	// Edit / update / tools
	Pencil: "text-blue-600",
	PencilIcon: "text-blue-600",
	RefreshCw: "text-blue-600",
	RefreshCwIcon: "text-blue-600",
	RefreshCcw: "text-blue-600",
	RotateCcw: "text-blue-600",
	Undo2: "text-blue-600",
	Wrench: "text-blue-600",
	Settings2: "text-blue-600",

	// Warning / attention
	TrendingDown: "text-amber-600",
	AlertTriangle: "text-amber-600",
	AlertTriangleIcon: "text-amber-600",
	AlertCircle: "text-amber-600",
	TriangleAlertIcon: "text-amber-600",
	ShieldAlert: "text-amber-600",
	Lightbulb: "text-amber-600",

	// Info / help
	Info: "text-sky-600",
	InfoIcon: "text-sky-600",
	HelpCircle: "text-sky-600",
	BookOpen: "text-sky-600",
	Activity: "text-sky-600",
	LayoutDashboard: "text-sky-600",

	// Security
	ShieldCheck: "text-violet-600",
	ShieldCheckIcon: "text-violet-600",
	KeyRoundIcon: "text-violet-600",

	// Financial / commerce
	DollarSign: "text-green-600",
	IndianRupee: "text-green-600",
	Receipt: "text-green-600",
	ReceiptText: "text-green-600",
	Calculator: "text-green-600",
	ShoppingCart: "text-green-600",
	TrendingUp: "text-green-600",
	BarChart3: "text-green-600",
	LineChart: "text-green-600",
	PieChart: "text-green-600",

	// People
	User: "text-purple-600",
	UserCircle: "text-purple-600",
	Users: "text-purple-600",
	UsersIcon: "text-purple-600",
	UserCheck: "text-purple-600",
	UserCog: "text-purple-600",
	UserCogIcon: "text-purple-600",
	Briefcase: "text-purple-600",
	BriefcaseIcon: "text-purple-600",
	Building2: "text-purple-600",

	// Time / schedule / logistics
	Calendar: "text-orange-600",
	CalendarRange: "text-orange-600",
	Clock: "text-orange-600",
	Timer: "text-orange-600",
	Truck: "text-orange-600",
	History: "text-orange-600",

	// Communication
	Mail: "text-indigo-600",
	MailIcon: "text-indigo-600",
	MailCheckIcon: "text-indigo-600",
	Phone: "text-indigo-600",
	MessageSquare: "text-indigo-600",
	Bell: "text-indigo-600",
	MapPin: "text-indigo-600",

	// Documents / files / technical infra
	FileText: "text-slate-600",
	FileTextIcon: "text-slate-600",
	FileSpreadsheet: "text-slate-600",
	FileDown: "text-slate-600",
	Download: "text-slate-600",
	UploadCloud: "text-slate-600",
	CloudUpload: "text-slate-600",
	Paperclip: "text-slate-600",
	ScrollTextIcon: "text-slate-600",
	Printer: "text-slate-600",
	Inbox: "text-slate-600",
	DatabaseIcon: "text-slate-600",
	ServerIcon: "text-slate-600",
	Package: "text-slate-600",
	Boxes: "text-slate-600",
	GitBranchIcon: "text-slate-600",
	Network: "text-slate-600",
	Hash: "text-slate-600",
	Layers: "text-slate-600",
	Tag: "text-slate-600",
	ClipboardList: "text-slate-600",
	ClipboardListIcon: "text-slate-600",
	Camera: "text-slate-600",
	Globe: "text-slate-600",

	// Search / filter
	Search: "text-slate-500",
	SearchIcon: "text-slate-500",
	SlidersHorizontal: "text-slate-500",

	// Neutral / navigation / chrome
	ChevronDown: "text-muted-foreground",
	ChevronDownIcon: "text-muted-foreground",
	ChevronLeft: "text-muted-foreground",
	ChevronLeftIcon: "text-muted-foreground",
	ChevronRight: "text-muted-foreground",
	ChevronRightIcon: "text-muted-foreground",
	ChevronsLeft: "text-muted-foreground",
	ChevronsLeftIcon: "text-muted-foreground",
	ChevronsRight: "text-muted-foreground",
	ChevronsRightIcon: "text-muted-foreground",
	ChevronsUpDown: "text-muted-foreground",
	ChevronUp: "text-muted-foreground",
	ChevronUpIcon: "text-muted-foreground",
	ArrowDown: "text-muted-foreground",
	ArrowDownRight: "text-muted-foreground",
	ArrowLeft: "text-muted-foreground",
	ArrowRight: "text-muted-foreground",
	ArrowRightLeft: "text-muted-foreground",
	ArrowUp: "text-muted-foreground",
	ArrowUpDown: "text-muted-foreground",
	ArrowUpRight: "text-muted-foreground",
	X: "text-muted-foreground",
	XIcon: "text-muted-foreground",
	Menu: "text-muted-foreground",
	MoreHorizontal: "text-muted-foreground",
	PanelLeft: "text-muted-foreground",
	Moon: "text-muted-foreground",
	Sun: "text-muted-foreground",
	Play: "text-muted-foreground",
	Eye: "text-muted-foreground",
	EyeOff: "text-muted-foreground",
	CopyIcon: "text-muted-foreground",
	LogOut: "text-muted-foreground",
	LogOutIcon: "text-muted-foreground",
	Minus: "text-muted-foreground",
	Radius: "text-muted-foreground",
	LayoutGridIcon: "text-muted-foreground",

	// Loading (inherits currentColor, not colorized)
	Loader2: null,
	Loader2Icon: null,

};

/** Fallback color for any icon not explicitly listed in ICON_COLORS. */
export const DEFAULT_ICON_COLOR = "text-muted-foreground";
