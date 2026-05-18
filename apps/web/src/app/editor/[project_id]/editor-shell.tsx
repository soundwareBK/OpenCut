"use client";

import { useParams } from "next/navigation";
import {
	ResizablePanelGroup,
	ResizablePanel,
	ResizableHandle,
} from "@/components/ui/resizable";
import { AssetsPanel } from "@/components/editor/panels/assets";
import { PropertiesPanel } from "@/components/editor/panels/properties";
import { Timeline } from "@/timeline/components";
import { PreviewPanel } from "@/preview/components";
import { EditorProvider } from "@/components/providers/editor-provider";
import { Onboarding } from "@/components/editor/onboarding";
import { MigrationDialog } from "@/project/components/migration-dialog";
import { usePanelStore } from "@/editor/panel-store";
import { usePasteMedia } from "@/media/use-paste-media";
import { MobileGate } from "@/components/editor/mobile-gate";
import { useMemo, useState } from "react";
import { useEditor } from "@/editor/use-editor";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { ChangelogNotification } from "@/changelog/components/changelog-notification";
import {
	createPreviewOverlayControl,
	isPreviewOverlayVisible,
	mergePreviewOverlaySources,
} from "@/preview/overlays";
import { usePreviewStore } from "@/preview/preview-store";
import { getGuidePreviewOverlaySource } from "@/guides";
import {
	bookmarkNotesPreviewOverlay,
	getBookmarkPreviewOverlaySource,
} from "@/timeline/bookmarks/index";
// Vizzy bridge — listens for the host's per-frame audio signals and
// records discrete beat/drop events for snap-to-beat features.
import { VizzyBridgeMount } from "@/lib/vizzy/bridge";
import { VizzySignalIndicator } from "@/lib/vizzy/signal-indicator";
import { ExportButton } from "@/components/editor/export-button";
// Auto-importer: pulls in the audio + video clips the user already had
// loaded in Vizzy's basic mode so flipping into Advanced Mode finds the
// same project state pre-populated on the timeline panel.
import { VizzyAutoImporter } from "@/lib/vizzy/auto-importer";
// Live preview: floating tile mirroring Vizzy's reactive visualizer.
import { VizzyLivePreview } from "@/lib/vizzy/live-preview";
// Vizzy mobile shell — vertical CapCut-style layout for phone & tablet.
// Selected based on viewport size in EditorLayout below; desktop keeps the
// existing ResizablePanelGroup layout unchanged.
import { useViewport } from "@/hooks/use-viewport";
import { MobileEditorShell } from "@/mobile/editor-shell";

export default function Editor() {
	const params = useParams();
	const projectId = params.project_id as string;

	// Vizzy fork: this bundle is only ever loaded inside Vizzy's iframe and
	// the host owns the persistent chrome (logo, project name, mode pill,
	// settings, export). Rendering the OpenCut editor-header here would
	// stack a duplicate bar on top of Vizzy's, so we leave it out.
	// The project-rename, export, and exit affordances move to the host
	// header in Phase D (state bridge); for now, project name is implicit
	// and exit happens via the mode pill.
	return (
		<MobileGate>
			<VizzyBridgeMount />
			<EditorProvider projectId={projectId}>
				<div className="bg-background flex h-screen w-screen flex-col overflow-hidden">
					<DegradedRendererBanner />
					<div className="min-h-0 min-w-0 flex-1">
						<EditorLayout />
					</div>
					{/* Floating export — the only thing kept from the old editor
					    header. Host chrome (logo, project name, mode pill,
					    settings) lives in Vizzy; this stays inside the iframe
					    so OpenCut's export popover (which depends on editor
					    state) opens without a postMessage bridge. */}
					<div className="pointer-events-none absolute top-2 right-3 z-50">
						<div className="pointer-events-auto">
							<ExportButton />
						</div>
					</div>
					<Onboarding />
					<MigrationDialog />
					<ChangelogNotification />
					<VizzyAutoImporter />
					<VizzyLivePreview />
					<VizzySignalIndicator />
				</div>
			</EditorProvider>
		</MobileGate>
	);
}

function DegradedRendererBanner() {
	const isDegraded = useEditor((e) => e.renderer.isDegraded);
	const [dismissed, setDismissed] = useState(false);
	if (!isDegraded || dismissed) return null;

	return (
		<div className="bg-accent border-b h-9 flex items-center justify-center gap-2 text-xs text-muted-foreground">
			<span>For the best experience, open OpenCut in Chrome.</span>
			<Button
				variant="text"
				size="icon"
				className="p-0 w-auto [&_svg]:size-3.5"
				onClick={() => setDismissed(true)}
				aria-label="Dismiss"
			>
				<HugeiconsIcon icon={Cancel01Icon} />
			</Button>
		</div>
	);
}

function EditorLayout() {
	usePasteMedia();
	const { panels, setPanel } = usePanelStore();
	const activeScene = useEditor((editor) =>
		editor.scenes.getActiveSceneOrNull(),
	);
	const currentTime = useEditor((editor) => editor.playback.getCurrentTime());
	const activeGuide = usePreviewStore((state) => state.activeGuide);
	const overlays = usePreviewStore((state) => state.overlays);
	const setOverlayVisibility = usePreviewStore(
		(state) => state.setOverlayVisibility,
	);
	const showBookmarkNotes = isPreviewOverlayVisible({
		overlay: bookmarkNotesPreviewOverlay,
		overlays,
	});
	const { isCompact } = useViewport();

	const overlaySource = useMemo(
		() =>
			mergePreviewOverlaySources({
				sources: [
					getGuidePreviewOverlaySource({
						guideId: activeGuide,
					}),
					activeScene
						? getBookmarkPreviewOverlaySource({
								bookmarks: activeScene.bookmarks,
								time: currentTime,
								isVisible: showBookmarkNotes,
							})
						: {
								definitions: [bookmarkNotesPreviewOverlay],
								instances: [],
							},
				],
			}),
		[activeGuide, activeScene, currentTime, showBookmarkNotes],
	);

	const overlayControls = useMemo(
		() =>
			overlaySource.definitions.map((overlay) =>
				createPreviewOverlayControl({ overlay, overlays }),
			),
		[overlaySource.definitions, overlays],
	);

	const previewProps = {
		overlayControls,
		overlayInstances: overlaySource.instances,
		onOverlayVisibilityChange: setOverlayVisibility,
	};

	if (isCompact) {
		return <MobileEditorShell previewProps={previewProps} />;
	}

	return (
		<ResizablePanelGroup
			direction="vertical"
			className="size-full gap-[0.18rem]"
			onLayout={(sizes) => {
				setPanel({
					panel: "mainContent",
					size: sizes[0] ?? panels.mainContent,
				});
				setPanel({
					panel: "timeline",
					size: sizes[1] ?? panels.timeline,
				});
			}}
		>
			<ResizablePanel
				defaultSize={panels.mainContent}
				minSize={30}
				maxSize={85}
				className="min-h-0"
			>
				<ResizablePanelGroup
					direction="horizontal"
					className="size-full gap-[0.19rem] px-3"
					onLayout={(sizes) => {
						setPanel({ panel: "tools", size: sizes[0] ?? panels.tools });
						setPanel({ panel: "preview", size: sizes[1] ?? panels.preview });
						setPanel({
							panel: "properties",
							size: sizes[2] ?? panels.properties,
						});
					}}
				>
					<ResizablePanel
						defaultSize={panels.tools}
						minSize={15}
						maxSize={40}
						className="min-w-0"
					>
						<AssetsPanel />
					</ResizablePanel>

					<ResizableHandle withHandle />

					<ResizablePanel
						defaultSize={panels.preview}
						minSize={30}
						className="min-h-0 min-w-0 flex-1"
					>
						<PreviewPanel
							overlayControls={overlayControls}
							overlayInstances={overlaySource.instances}
							onOverlayVisibilityChange={setOverlayVisibility}
						/>
					</ResizablePanel>

					<ResizableHandle withHandle />

					<ResizablePanel
						defaultSize={panels.properties}
						minSize={15}
						maxSize={40}
						className="min-w-0"
					>
						<PropertiesPanel />
					</ResizablePanel>
				</ResizablePanelGroup>
			</ResizablePanel>

			<ResizableHandle withHandle />

			<ResizablePanel
				defaultSize={panels.timeline}
				minSize={15}
				maxSize={70}
				className="min-h-0 px-3 pb-3"
			>
				<Timeline />
			</ResizablePanel>
		</ResizablePanelGroup>
	);
}
