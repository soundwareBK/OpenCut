"use client";

/* ============================================================================
 * Vizzy mobile shell — bottom tab bar (CapCut-style).
 *
 * Horizontally scrollable strip of category buttons. Tapping a tab activates
 * it in the assets-panel-store AND opens the bottom drawer that hosts the
 * tab's view. The drawer (assets-drawer.tsx) reads `activeTab` from the same
 * store, so this component only needs to fire the open + setTab actions.
 *
 * Hit target sized for thumbs (64×64 minimum block); fade gradients at the
 * left/right edges mirror the desktop vertical tabbar treatment.
 * ========================================================================== */

import { useCallback, useEffect, useRef, useState } from "react";
import {
	TAB_KEYS,
	tabs,
	useAssetsPanelStore,
} from "@/components/editor/panels/assets/assets-panel-store";
import { cn } from "@/utils/ui";
import { useViewport } from "@/hooks/use-viewport";

export function MobileToolbar() {
	const { activeTab, openMobileDrawer, mobileDrawerOpen } =
		useAssetsPanelStore();
	const { size } = useViewport();
	const isPhone = size === "phone";
	const scrollRef = useRef<HTMLDivElement>(null);
	const [showLeftFade, setShowLeftFade] = useState(false);
	const [showRightFade, setShowRightFade] = useState(true);

	const checkScrollPosition = useCallback(() => {
		const el = scrollRef.current;
		if (!el) return;
		setShowLeftFade(el.scrollLeft > 0);
		setShowRightFade(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
	}, []);

	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		checkScrollPosition();
		el.addEventListener("scroll", checkScrollPosition);
		const ro = new ResizeObserver(checkScrollPosition);
		ro.observe(el);
		return () => {
			el.removeEventListener("scroll", checkScrollPosition);
			ro.disconnect();
		};
	}, [checkScrollPosition]);

	return (
		<div
			className="relative shrink-0 border-t bg-background"
			style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
		>
			<div
				ref={scrollRef}
				className={cn(
					"scrollbar-hidden flex items-stretch overflow-x-auto overflow-y-hidden",
					isPhone ? "h-16" : "h-20",
				)}
				style={{ scrollbarWidth: "none" }}
			>
				{TAB_KEYS.map((tabKey) => {
					const tab = tabs[tabKey];
					const isActive = mobileDrawerOpen && activeTab === tabKey;
					return (
						<button
							key={tabKey}
							type="button"
							onClick={() => openMobileDrawer(tabKey)}
							aria-label={tab.label}
							aria-pressed={isActive}
							className={cn(
								"flex shrink-0 flex-col items-center justify-center gap-1 transition-colors text-muted-foreground active:bg-accent/60",
								isPhone ? "min-w-16 px-4" : "min-w-20 px-5",
								isActive && "text-foreground",
							)}
						>
							<span className={isPhone ? "[&_svg]:size-5" : "[&_svg]:size-6"}>
								<tab.icon />
							</span>
							<span
								className={cn(
									"tracking-wide leading-none",
									isPhone ? "text-[10px]" : "text-xs",
								)}
							>
								{tab.label}
							</span>
						</button>
					);
				})}
			</div>

			<EdgeFade side="left" show={showLeftFade} />
			<EdgeFade side="right" show={showRightFade} />
		</div>
	);
}

function EdgeFade({ side, show }: { side: "left" | "right"; show: boolean }) {
	return (
		<div
			aria-hidden
			className={cn(
				"pointer-events-none absolute top-0 bottom-0 w-6 transition-opacity duration-150",
				side === "left"
					? "left-0 bg-linear-to-r from-background to-transparent"
					: "right-0 bg-linear-to-l from-background to-transparent",
				show ? "opacity-100" : "opacity-0",
			)}
		/>
	);
}
