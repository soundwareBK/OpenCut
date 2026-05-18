"use client";

/* ============================================================================
 * Vizzy mobile shell — bottom-sheet drawer hosting AssetsPanel views.
 *
 * Renders the active tab's existing view component inside a Sheet anchored
 * to the bottom of the viewport. Open state lives on assets-panel-store so
 * the tab bar at the bottom can flip it without prop drilling.
 *
 * The view components don't know anything about a drawer — they render with
 * a constrained height container and natural overflow scrolling. Some views
 * (captions, transcription) host their own scroll regions; we just give the
 * sheet a max-height and let the content figure out the rest.
 * ========================================================================== */

import {
	Sheet,
	SheetContent,
	SheetTitle,
} from "@/components/ui/sheet";
import {
	type Tab,
	tabs,
	useAssetsPanelStore,
} from "@/components/editor/panels/assets/assets-panel-store";
import { MediaView } from "@/components/editor/panels/assets/views/assets";
import { SettingsView } from "@/components/editor/panels/assets/views/settings";
import { SoundsView } from "@/sounds/components/assets-view";
import { StickersView } from "@/stickers/components/assets-view";
import { TextView } from "@/text/components/assets-view";
import { EffectsView } from "@/effects/components/assets-view";
import { Captions } from "@/subtitles/components/assets-view";
import { useViewport } from "@/hooks/use-viewport";

const VIEW_MAP: Record<Tab, React.ReactNode> = {
	media: <MediaView />,
	sounds: <SoundsView />,
	text: <TextView />,
	stickers: <StickersView />,
	effects: <EffectsView />,
	transitions: (
		<div className="text-muted-foreground p-4">
			Transitions view coming soon...
		</div>
	),
	captions: <Captions />,
	adjustment: (
		<div className="text-muted-foreground p-4">
			Adjustment view coming soon...
		</div>
	),
	settings: <SettingsView />,
};

export function MobileAssetsDrawer() {
	const { activeTab, mobileDrawerOpen, closeMobileDrawer } =
		useAssetsPanelStore();
	const { size } = useViewport();
	// Phone uses ~85% of screen so the user has enough room to scan content
	// (Media tab can have lots of clips). Tablet keeps the preview/timeline
	// visible above the drawer — ~65% feels CapCut-like.
	const heightClass = size === "phone" ? "h-[85dvh]" : "h-[65dvh]";

	return (
		<Sheet
			open={mobileDrawerOpen}
			onOpenChange={(open) => {
				if (!open) closeMobileDrawer();
			}}
		>
			<SheetContent
				side="bottom"
				className={`${heightClass} p-0 flex flex-col gap-0 rounded-t-xl`}
			>
				{/* Grab handle pill — purely decorative, signals draggable area. */}
				<div className="flex justify-center pt-2 pb-1">
					<div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
				</div>
				<SheetTitle className="px-4 pb-2 text-base font-semibold">
					{tabs[activeTab].label}
				</SheetTitle>
				<div className="flex-1 min-h-0 overflow-hidden">
					{VIEW_MAP[activeTab]}
				</div>
			</SheetContent>
		</Sheet>
	);
}
