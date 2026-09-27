import { ImageResponse } from "next/og";

export const alt = "Service+ — Repair workshop management software";
export const contentType = "image/png";
export const dynamic = "force-static";
export const size = { height: 630, width: 1200 };

const OpengraphImage = () => {
	return new ImageResponse(
		<div
			style={{
				background: "linear-gradient(135deg, #4338ca 0%, #2563eb 45%, #7c3aed 100%)",
				color: "white",
				display: "flex",
				flexDirection: "column",
				height: "100%",
				justifyContent: "center",
				padding: 80,
				width: "100%",
			}}
		>
			<div style={{ fontSize: 96, fontWeight: 800 }}>Service+</div>
			<div style={{ fontSize: 44, marginTop: 16, opacity: 0.9 }}>Run your repair workshop end to end</div>
			<div style={{ fontSize: 30, marginTop: 40, opacity: 0.8 }}>
				Jobs · Spare parts · GST invoicing · WhatsApp · Reports
			</div>
		</div>,
		size,
	);
};

export default OpengraphImage;
