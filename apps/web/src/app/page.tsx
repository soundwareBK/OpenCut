"use client";

// Vizzy fork: the bundle root redirects to the editor entry. The landing
// page (Hero/Header/Footer) belongs to the public opencut.app marketing
// site and has no purpose inside Vizzy's iframe.

import { useEffect } from "react";

export default function Home() {
	useEffect(() => {
		window.location.replace("./editor/default/");
	}, []);

	return (
		<div
			style={{
				margin: 0,
				background: "#0a0a0a",
				color: "rgba(255,255,255,0.6)",
				fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				height: "100vh",
			}}
		>
			<a href="./editor/default/" style={{ color: "inherit" }}>
				Loading editor…
			</a>
		</div>
	);
}
