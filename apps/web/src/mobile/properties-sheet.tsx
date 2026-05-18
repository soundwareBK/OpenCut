"use client";

/* ============================================================================
 * Vizzy mobile shell — bottom-sheet wrapper for PropertiesPanel.
 *
 * Auto-opens when a clip is selected, auto-closes when selection clears.
 * User can also dismiss manually via the sheet's close affordance; we don't
 * clear the actual selection in that case (different from desktop, where
 * the panel is always visible), so the user can re-tap the same clip and
 * see properties without losing other state.
 * ========================================================================== */

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { PropertiesPanel } from "@/components/editor/panels/properties";
import { useEditor } from "@/editor/use-editor";
import { useViewport } from "@/hooks/use-viewport";

export function MobilePropertiesSheet() {
	const selectedElements = useEditor((e) =>
		e.selection.getSelectedElements(),
	);
	const hasSelection = selectedElements.length > 0;
	const { size } = useViewport();
	// Phone properties sheet covers more of the screen since there's less of
	// it; tablet keeps the preview visible above the sheet for context.
	const heightClass = size === "phone" ? "h-[70dvh]" : "h-[55dvh]";
	const [open, setOpen] = useState(false);
	// Track when the user explicitly dismissed the sheet for a given
	// selection signature, so we don't keep re-opening on every render
	// while that selection is still active.
	const [dismissedSignature, setDismissedSignature] = useState<string | null>(
		null,
	);

	const selectionSignature = hasSelection
		? selectedElements
				.map((e) => `${e.trackId}:${e.elementId}`)
				.sort()
				.join(",")
		: null;

	useEffect(() => {
		if (!hasSelection) {
			setOpen(false);
			setDismissedSignature(null);
			return;
		}
		if (selectionSignature !== dismissedSignature) {
			setOpen(true);
		}
	}, [hasSelection, selectionSignature, dismissedSignature]);

	return (
		<Sheet
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next && hasSelection) {
					setDismissedSignature(selectionSignature);
				}
			}}
		>
			<SheetContent
				side="bottom"
				className={`${heightClass} p-0 flex flex-col gap-0 rounded-t-xl`}
			>
				<div className="flex justify-center pt-2 pb-1">
					<div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
				</div>
				<SheetTitle className="px-4 pb-2 text-base font-semibold">
					Properties
				</SheetTitle>
				<div className="flex-1 min-h-0 overflow-hidden">
					<PropertiesPanel />
				</div>
			</SheetContent>
		</Sheet>
	);
}
