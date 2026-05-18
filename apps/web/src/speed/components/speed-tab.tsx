import { useRef } from "react";
import { useEditor } from "@/editor/use-editor";
import { NumberField } from "@/components/ui/number-field";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { DashboardSpeed02Icon } from "@hugeicons/core-free-icons";
import { buildConstantRetime } from "@/retime";
import {
	DEFAULT_RETIME_RATE,
	MIN_RETIME_RATE,
	MAX_RETIME_RATE,
	clampRetimeRate,
	canMaintainPitch,
} from "@/retime/rate";
import type { AudioElement, VideoElement } from "@/timeline";
import { mediaTimeFromSeconds, mediaTimeToSeconds } from "@/wasm";
// Vizzy fork: BPM-locked beat sync — pick a beat count and the clip
// auto-stretches to fit while its speed compensates so the full source
// plays in that window.
import { useVizzyAutoBpm, useVizzyBpm, useVizzyBridge } from "@/lib/vizzy/bridge";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import {
	Section,
	SectionContent,
	SectionField,
	SectionFields,
	SectionHeader,
	SectionTitle,
} from "@/components/section";
import { usePropertyDraft } from "@/components/editor/panels/properties/hooks/use-property-draft";
import {
	formatNumberForDisplay,
	getFractionDigitsForStep,
	snapToStep,
} from "@/utils/math";

const SPEED_STEP = 0.01;
const SPEED_FRACTION_DIGITS = getFractionDigitsForStep({ step: SPEED_STEP });

function rateToDisplay({ rate }: { rate: number }): string {
	return formatNumberForDisplay({
		value: rate,
		fractionDigits: SPEED_FRACTION_DIGITS,
	});
}

function parseSpeedInput({ input }: { input: string }): number | null {
	const parsed = parseFloat(input);
	if (Number.isNaN(parsed)) return null;
	return clampRetimeRate({
		rate: snapToStep({ value: parsed, step: SPEED_STEP }),
	});
}

function buildRetime({
	rate,
	maintainPitch,
}: {
	rate: number;
	maintainPitch: boolean;
}) {
	if (rate === DEFAULT_RETIME_RATE && !maintainPitch) return undefined;
	return buildConstantRetime({ rate, maintainPitch });
}

export function SpeedTab({
	element,
	trackId,
}: {
	element: AudioElement | VideoElement;
	trackId: string;
}) {
	const editor = useEditor();
	const rate = clampRetimeRate({
		rate: element.retime?.rate ?? DEFAULT_RETIME_RATE,
	});
	const isPitchPreserveAvailable = canMaintainPitch({ rate });
	const maintainPitch = element.retime?.maintainPitch ?? false;
	const pendingRateRef = useRef(rate);

	const commitRetime = ({
		rate: nextRate,
		maintainPitch: nextMaintainPitch,
	}: {
		rate: number;
		maintainPitch: boolean;
	}) => {
		editor.timeline.updateElementRetime({
			trackId,
			elementId: element.id,
			retime: buildRetime({ rate: nextRate, maintainPitch: nextMaintainPitch }),
		});
	};

	const speedDraft = usePropertyDraft({
		displayValue: rateToDisplay({ rate }),
		parse: (input) => parseSpeedInput({ input }),
		onPreview: (nextRate) => {
			pendingRateRef.current = nextRate;
			editor.timeline.previewElements({
				updates: [
					{
						trackId,
						elementId: element.id,
						updates: {
							retime: buildRetime({ rate: nextRate, maintainPitch }),
						},
					},
				],
			});
		},
		onCommit: () => {
			commitRetime({ rate: pendingRateRef.current, maintainPitch });
		},
	});

	return (
		<Section collapsible sectionKey={`${element.id}:speed`}>
			<SectionHeader>
				<SectionTitle>Speed</SectionTitle>
			</SectionHeader>
			<SectionContent>
				<SectionFields>
					<SectionField label="Speed">
						<NumberField
							icon={<HugeiconsIcon icon={DashboardSpeed02Icon} />}
							value={speedDraft.displayValue}
							suffix="x"
							scrubRanges={[
								{ from: 0.01, to: 1, pixelsPerUnit: 160 },
								{ from: 1, to: 5, pixelsPerUnit: 48 },
							]}
							scrubClamp={{ min: MIN_RETIME_RATE, max: MAX_RETIME_RATE }}
							onFocus={() => {
								pendingRateRef.current = rate;
								speedDraft.onFocus();
							}}
							onChange={speedDraft.onChange}
							onBlur={speedDraft.onBlur}
							onScrub={speedDraft.scrubTo}
							onScrubEnd={speedDraft.commitScrub}
							onReset={() =>
								commitRetime({ rate: DEFAULT_RETIME_RATE, maintainPitch })
							}
							isDefault={rate === DEFAULT_RETIME_RATE}
						/>
					</SectionField>
					<div className="flex items-center justify-between">
						<span className="text-sm">Change pitch</span>
						<Switch
							checked={!maintainPitch}
							disabled={!isPitchPreserveAvailable}
							onCheckedChange={(checked) =>
								commitRetime({ rate, maintainPitch: !checked })
							}
						/>
					</div>
					<VizzyBeatSyncSection
						element={element}
						trackId={trackId}
						maintainPitch={maintainPitch}
					/>
				</SectionFields>
			</SectionContent>
		</Section>
	);
}

/**
 * Vizzy fork: "Beat sync" subsection — pick a beat count and the clip
 * snaps to that many beats of the analyzed audio. We update both the
 * element's `duration` (timeline footprint) AND `retime.rate` (source
 * playback speed) in a single patch so the full source plays exactly
 * within the chosen N beats.
 *
 * Math:
 *   secsPerBeat        = 60 / BPM
 *   targetTimelineSec  = N * secsPerBeat
 *   sourceSpanSec      = mediaTimeToSeconds(element.duration / current rate)
 *                        (i.e., how much source we currently consume)
 *   newRate            = sourceSpanSec / targetTimelineSec
 *
 * Rate is clamped to OpenCut's [0.01, 5] range. If the clamp activates,
 * the clip would otherwise need to compress more than 5x or stretch
 * slower than 100x — we surface that as a toast so the user knows
 * the result isn't a perfect fit.
 */
function VizzyBeatSyncSection({
	element,
	trackId,
	maintainPitch,
}: {
	element: AudioElement | VideoElement;
	trackId: string;
	maintainPitch: boolean;
}) {
	const editor = useEditor();
	const bpm = useVizzyBpm();
	const autoBpm = useVizzyAutoBpm();
	const userBpmOverride = useVizzyBridge((s) => s.userBpmOverride);
	const setUserBpmOverride = useVizzyBridge((s) => s.setUserBpmOverride);

	// Local input state: lets the user type freely (e.g. "12" en route to
	// "120") without committing partial values to the store.
	const [bpmInput, setBpmInput] = useState<string>(
		bpm > 0 ? bpm.toFixed(1) : "",
	);
	useEffect(() => {
		// Keep input in sync when bpm changes from elsewhere (analysis
		// completes, half/double clicked, reset to auto).
		if (bpm > 0 && document.activeElement?.tagName !== "INPUT") {
			setBpmInput(bpm.toFixed(1));
		} else if (bpm === 0) {
			setBpmInput("");
		}
	}, [bpm]);

	const commitBpmInput = () => {
		const parsed = parseFloat(bpmInput);
		if (Number.isFinite(parsed) && parsed > 0) {
			setUserBpmOverride(parsed);
		} else {
			// Empty / invalid → clear override (back to auto)
			setUserBpmOverride(null);
		}
	};

	const haveAnyBpm = bpm > 0 || autoBpm > 0;
	if (!haveAnyBpm) {
		// No analysis AND no manual override yet — show an entry-point that
		// lets the user type in a known BPM even before analyzing.
		return (
			<div className="space-y-2 border-t border-border pt-3">
				<div className="text-xs font-medium uppercase tracking-wider opacity-70">
					Beat sync
				</div>
				<div className="flex items-center gap-2">
					<input
						type="number"
						min="20"
						max="400"
						step="0.1"
						placeholder="BPM"
						value={bpmInput}
						onChange={(e) => setBpmInput(e.target.value)}
						onBlur={commitBpmInput}
						onKeyDown={(e) => {
							if (e.key === "Enter") (e.target as HTMLInputElement).blur();
						}}
						className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm"
					/>
					<span className="text-xs text-muted-foreground">
						Enter BPM or right-click the audio track → "Detect beats"
					</span>
				</div>
			</div>
		);
	}

	const currentRate = clampRetimeRate({
		rate: element.retime?.rate ?? DEFAULT_RETIME_RATE,
	});
	const elementDurationSec = mediaTimeToSeconds({ time: element.duration });
	const sourceSpanSec = elementDurationSec * currentRate;
	const secsPerBeat = 60 / bpm;

	const applyBeats = (beats: number) => {
		const targetTimelineSec = beats * secsPerBeat;
		const idealRate = sourceSpanSec / targetTimelineSec;
		const newRate = clampRetimeRate({ rate: idealRate });
		const clamped = Math.abs(newRate - idealRate) > 1e-6;

		editor.timeline.updateElements({
			updates: [
				{
					trackId,
					elementId: element.id,
					patch: {
						duration: mediaTimeFromSeconds({ seconds: targetTimelineSec }),
						retime: buildConstantRetime({
							rate: newRate,
							maintainPitch,
						}),
					},
				},
			],
		});

		if (clamped) {
			toast.warning(
				`Speed clamped to ${newRate.toFixed(2)}x (max range is ${MIN_RETIME_RATE}–${MAX_RETIME_RATE}x)`,
				{ description: "Try a different beat count for a perfect fit." },
			);
		} else {
			toast.success(
				`Fit to ${beats} beats — ${targetTimelineSec.toFixed(2)}s @ ${newRate.toFixed(2)}x speed`,
			);
		}
	};

	const beatChoices: number[] = [1, 2, 4, 8, 16, 32];

	return (
		<div className="space-y-2 border-t border-border pt-3">
			<div className="flex items-center justify-between text-xs">
				<span className="font-medium uppercase tracking-wider opacity-70">
					Beat sync
				</span>
				<span className="text-muted-foreground">
					{secsPerBeat.toFixed(3)}s/beat
				</span>
			</div>

			{/* BPM input row: number field + halve / double / reset-to-auto. */}
			<div className="flex items-center gap-1">
				<input
					type="number"
					min="20"
					max="400"
					step="0.1"
					value={bpmInput}
					onChange={(e) => setBpmInput(e.target.value)}
					onBlur={commitBpmInput}
					onKeyDown={(e) => {
						if (e.key === "Enter") (e.target as HTMLInputElement).blur();
					}}
					className="w-16 rounded-md border border-border bg-background px-2 py-1 text-sm tabular-nums"
					title="BPM (editable). Press Enter or click away to apply."
				/>
				<span className="text-xs text-muted-foreground">BPM</span>
				<Button
					variant="outline"
					size="sm"
					onClick={() => setUserBpmOverride(bpm / 2)}
					className="text-[10px] px-2 ml-auto"
					title="Half-time — useful if analyzer picked the wrong tempo octave"
				>
					÷2
				</Button>
				<Button
					variant="outline"
					size="sm"
					onClick={() => setUserBpmOverride(bpm * 2)}
					className="text-[10px] px-2"
					title="Double-time"
				>
					×2
				</Button>
				{userBpmOverride !== null && autoBpm > 0 ? (
					<Button
						variant="outline"
						size="sm"
						onClick={() => setUserBpmOverride(null)}
						className="text-[10px] px-2"
						title={`Reset to auto-detected (${autoBpm.toFixed(1)} BPM)`}
					>
						Auto
					</Button>
				) : null}
			</div>
			{userBpmOverride !== null && autoBpm > 0 ? (
				<div className="text-[10px] leading-tight text-muted-foreground">
					Manual override · auto-detected was {autoBpm.toFixed(1)} BPM
				</div>
			) : null}

			<div className="grid grid-cols-6 gap-1">
				{beatChoices.map((n) => {
					const targetSec = n * secsPerBeat;
					const targetRate = clampRetimeRate({
						rate: sourceSpanSec / targetSec,
					});
					return (
						<Button
							key={n}
							variant="outline"
							size="sm"
							onClick={() => applyBeats(n)}
							className="text-xs px-1"
							title={`${n} beat${n === 1 ? "" : "s"} · ${targetSec.toFixed(2)}s · ${targetRate.toFixed(2)}x`}
						>
							{n}
						</Button>
					);
				})}
			</div>
			<p className="text-[10px] leading-tight text-muted-foreground">
				Clip stretches to N beats; speed compensates so the full source
				plays in that window.
			</p>
		</div>
	);
}
