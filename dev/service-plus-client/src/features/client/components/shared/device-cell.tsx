import { cn } from "@/lib/utils";

// The one definition of how a job's device and serial no appear in a grid: the device text,
// with "SN: <value>" in dark teal beneath it. Every grid and on-screen device display uses these
// helpers instead of hand-writing its own serial line, so the label and style stay consistent.

type DeviceCellPropsType = {
	deviceDetails: string | null | undefined;
	serialNo: string | null | undefined;
};

type SerialNoLinePropsType = {
	className?: string;
	serialNo: string | null | undefined;
};

export function serialNoText(serialNo: string | null | undefined): string {
	const sn = serialNo?.trim() ?? "";
	return sn ? `SN: ${sn}` : "";
}

// Several job queries build device_details server-side as CONCAT_WS(' ', product, brand,
// model, serial_no). That text is left as-is because PDFs, WhatsApp messages and dialogs
// read it too; grids strip the trailing serial here so the SN line doesn't repeat it.
// Same test as deliver-job-pdf.ts.
export function stripTrailingSerial(
	deviceDetails: string | null | undefined,
	serialNo: string | null | undefined,
): string {
	const text = deviceDetails?.trim() ?? "";
	const sn = serialNo?.trim() ?? "";
	if (!sn || !text.endsWith(sn)) return text;
	return text.slice(0, text.length - sn.length).trim();
}

// Dark teal, semibold and letter-spaced so the serial is easy to read off the screen when
// matching a device in hand. whitespace-nowrap keeps "SN:" and the value on one line.
export const SerialNoLine = ({ className, serialNo }: SerialNoLinePropsType) => {
	const sn = serialNo?.trim() ?? "";
	if (!sn) return null;
	return (
		<span className={cn("mt-0.5 block whitespace-nowrap text-teal-800 text-xs dark:text-teal-300", className)}>
			SN: <span className="font-mono font-semibold tracking-wider">{sn}</span>
		</span>
	);
};

export const DeviceCell = ({ deviceDetails, serialNo }: DeviceCellPropsType) => {
	const device = stripTrailingSerial(deviceDetails, serialNo);
	return (
		<div className="flex flex-col gap-0.5">
			<span className="text-xs leading-snug">{device || "—"}</span>
			<SerialNoLine serialNo={serialNo} />
		</div>
	);
};
