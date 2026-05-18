"use client";

/**
 * Magic Auto-Cut options dialog.
 *
 * Industry-standard pattern (CapCut Auto Cut, iMovie Magic Movie, Premiere
 * "Sequence from clips"): user picks a rhythm + clip subset, sees a live
 * preview of how many cuts will be placed, then commits. Result is a
 * single undoable batch — Ctrl-Z reverts the whole arrangement at once.
 *
 * Live preview math runs every render (cheap — just grid timestamps), so
 * tweaking rhythm or start-beat updates the "X cuts across Y clips" line
 * before the user commits.
 */

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useEditor } from "@/editor/use-editor";
import { useVizzyBridge } from "./bridge";
import {
	applyMagicCut,
	DEFAULT_OPTIONS,
	previewMagicCut,
	type MagicCutOptions,
	type RhythmMode,
} from "./magic-cut";

interface MagicCutDialogProps {
	open: boolean;
	onClose: () => void;
}

const RHYTHM_CHOICES: { value: RhythmMode; label: string; hint: string }[] = [
	{ value: "smart", label: "Smart", hint: "Auto-pick based on song tempo" },
	{ value: 1, label: "Every beat", hint: "Rapid, EDM-style cuts" },
	{ value: 2, label: "Every 2 beats", hint: "Half-bar" },
	{ value: 4, label: "Every 4 beats", hint: "Bar — most common" },
	{ value: 8, label: "Every 8 beats", hint: "Phrase — slower montage" },
	{ value: "drops", label: "Drops only", hint: "Cut on detected drops" },
];

export function MagicCutDialog({ open, onClose }: MagicCutDialogProps) {
	const editor = useEditor();
	const offlineReady = useVizzyBridge((s) => (s.offline?.beats.length ?? 0) > 0);
	const songDuration = useVizzyBridge((s) => s.offline?.duration ?? 0);
	const totalBeats = useVizzyBridge((s) => s.offline?.beats.length ?? 0);
	const totalDrops = useVizzyBridge((s) => s.offline?.drops.length ?? 0);

	const allVideoAssets = useEditor((e) =>
		e.media.getAssets().filter((a) => a.type === "video"),
	);

	const [options, setOptions] = useState<MagicCutOptions>(() => ({
		...DEFAULT_OPTIONS,
	}));

	// Compute live preview on every render — cheap (just grid math).
	const preview = useMemo(
		() => (offlineReady ? previewMagicCut(options) : null),
		// preview depends on rhythm, includeAssetIds, startBeatIndex; explicit
		// dep on `options` makes that work.
		[options, offlineReady],
	);

	const includedClipCount = options.includeAssetIds.length || allVideoAssets.length;
	const canApply = offlineReady && allVideoAssets.length > 0 && (preview?.totalCuts ?? 0) > 0;

	function toggleAsset(id: string) {
		setOptions((o) => {
			// Empty `includeAssetIds` means "all" — first toggle materializes
			// the current "all" set so the user can subtract from it.
			const baseline = o.includeAssetIds.length
				? o.includeAssetIds
				: allVideoAssets.map((a) => a.id);
			const set = new Set(baseline);
			if (set.has(id)) set.delete(id);
			else set.add(id);
			return { ...o, includeAssetIds: Array.from(set) };
		});
	}

	function handleApply() {
		try {
			const result = applyMagicCut(options);
			toast.success(
				`Placed ${result.placed} clips across ${result.beatsUsed} beats`,
				{ description: "Ctrl-Z to undo the whole sequence." },
			);
			onClose();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : String(err));
		}
	}

	return (
		<Dialog open={open} onOpenChange={(v) => !v && onClose()}>
			<DialogContent className="sm:max-w-[520px]">
				<DialogHeader>
					<DialogTitle>Magic Auto-Cut</DialogTitle>
					<DialogDescription>
						Distribute your video clips along the song's beat grid in one step. Undo as one action.
					</DialogDescription>
				</DialogHeader>
				<DialogBody className="space-y-5">
					{!offlineReady ? (
						<div className="text-muted-foreground text-sm">
							Vizzy needs to analyze an audio file before it can place cuts on
							the beat. Import an audio file in basic mode (it'll auto-sync to
							the editor) and try again.
						</div>
					) : (
						<>
							{/* Rhythm picker */}
							<div className="space-y-2">
								<Label className="text-xs uppercase tracking-wider opacity-70">
									Rhythm
								</Label>
								<div className="grid grid-cols-3 gap-2">
									{RHYTHM_CHOICES.map((choice) => {
										const active = options.rhythm === choice.value;
										return (
											<button
												type="button"
												key={String(choice.value)}
												onClick={() =>
													setOptions((o) => ({ ...o, rhythm: choice.value }))
												}
												className={
													"rounded-md border px-3 py-2 text-left text-sm transition-colors " +
													(active
														? "border-primary bg-accent text-foreground"
														: "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground")
												}
											>
												<div className="font-medium">{choice.label}</div>
												<div className="text-[10px] opacity-70">{choice.hint}</div>
											</button>
										);
									})}
								</div>
							</div>

							{/* Start-beat offset */}
							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<Label className="text-xs uppercase tracking-wider opacity-70" htmlFor="vizzy-startbeat">
										Skip intro
									</Label>
									<span className="text-xs opacity-70">
										start at beat {options.startBeatIndex}
									</span>
								</div>
								<input
									id="vizzy-startbeat"
									type="range"
									min={0}
									max={Math.max(0, totalBeats - 1)}
									step={1}
									value={options.startBeatIndex}
									onChange={(e) =>
										setOptions((o) => ({
											...o,
											startBeatIndex: parseInt(e.target.value, 10) || 0,
										}))
									}
									className="w-full"
								/>
							</div>

							{/* Clip subset */}
							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<Label className="text-xs uppercase tracking-wider opacity-70">
										Clips to use
									</Label>
									<span className="text-xs opacity-70">
										{includedClipCount} of {allVideoAssets.length}
									</span>
								</div>
								{allVideoAssets.length === 0 ? (
									<div className="text-muted-foreground text-sm">
										No video clips imported yet. Drop some clips in basic mode
										or the assets panel.
									</div>
								) : (
									<div className="max-h-32 overflow-y-auto rounded-md border p-2 space-y-1">
										{allVideoAssets.map((asset) => {
											const isChecked =
												options.includeAssetIds.length === 0 ||
												options.includeAssetIds.includes(asset.id);
											return (
												<label
													key={asset.id}
													className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent/40 rounded px-1 py-1"
												>
													<Checkbox
														checked={isChecked}
														onCheckedChange={() => toggleAsset(asset.id)}
													/>
													<span className="flex-1 truncate">{asset.name}</span>
												</label>
											);
										})}
									</div>
								)}
							</div>

							{/* Single boolean — clear track first */}
							<label className="flex items-center gap-3 cursor-pointer">
								<Checkbox
									checked={options.clearVideoTracksFirst}
									onCheckedChange={(v) =>
										setOptions((o) => ({
											...o,
											clearVideoTracksFirst: v === true,
										}))
									}
								/>
								<div>
									<div className="text-sm">Clear video tracks first</div>
									<div className="text-muted-foreground text-xs">
										Recommended — replaces any manual arrangement on video tracks with the auto-cut sequence. Disable to layer the auto-cut on top of what you have.
									</div>
								</div>
							</label>

							{/* Live preview line */}
							{preview ? (
								<div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
									<div className="flex items-center justify-between">
										<span className="opacity-80">
											{preview.totalCuts} cuts across {Math.round(songDuration)}s
										</span>
										<span className="opacity-60 text-xs">{preview.mode}</span>
									</div>
									<div className="text-muted-foreground text-xs">
										{totalBeats} beats / {totalDrops} drops detected
									</div>
								</div>
							) : null}
						</>
					)}
				</DialogBody>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button onClick={handleApply} disabled={!canApply}>
						Apply{" "}
						{preview?.totalCuts
							? `· ${preview.totalCuts} cuts`
							: ""}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
