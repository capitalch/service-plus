import { ImageResponse } from "next/og";

export const contentType = "image/png";
export const dynamic = "force-static";
export const size = { height: 64, width: 64 };

const Icon = () => {
	return new ImageResponse(
		<div
			style={{
				alignItems: "center",
				background: "linear-gradient(135deg, #4338ca 0%, #2563eb 45%, #7c3aed 100%)",
				borderRadius: 14,
				color: "white",
				display: "flex",
				fontSize: 44,
				fontWeight: 800,
				height: "100%",
				justifyContent: "center",
				width: "100%",
			}}
		>
			S+
		</div>,
		size,
	);
};

export default Icon;
