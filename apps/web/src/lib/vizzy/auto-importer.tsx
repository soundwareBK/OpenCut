"use client";

/**
 * Vizzy → OpenCut media auto-importer.
 *
 * Watches the bridge store for media handed off by the host (the audio
 * track loaded in basic mode + the entire video queue), fetches each
 * blob URL into a real File on the iframe side, runs them through
 * OpenCut's canonical `processMediaAssets` pipeline, and registers the
 * results via `editor.media.addMediaAsset`. This is the same path
 * triggered by drag-and-dropping a file onto the Assets panel — so the
 * imported items behave identically to manually-imported media.
 *
 * Idempotency: each (kind, name, blobUrl) tuple is recorded after import
 * so we don't re-import on every state change. The bridge re-sends the
 * full snapshot each time Advanced Mode is reopened, which is fine —
 * we'll skip anything we've already imported in this iframe lifetime.
 *
 * Renders nothing. Mount once inside `EditorProvider` after a project is
 * active, so `editor.media.addMediaAsset` has somewhere to write to.
 */

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useEditor } from "@/editor/use-editor";
import { processMediaAssets } from "@/media/processing";
import { useVizzyBridge, type VizzyMedia, type VizzyQueueItem } from "./bridge";
import { analyzeAndStoreCurve } from "./analyze-controller";

export function VizzyAutoImporter() {
	const editor = useEditor();
	const activeProject = useEditor((e) => e.project.getActive());
	const audioMedia = useVizzyBridge((s) => s.audioMedia);
	const videoQueue = useVizzyBridge((s) => s.videoQueue);

	// Set of "fingerprints" (kind:name:blobUrl) we've already imported so
	// repeated snapshots from the host don't duplicate assets.
	const importedRef = useRef<Set<string>>(new Set());
	// Prevent overlapping import runs (parallel useEffects firing while a
	// previous import is mid-flight).
	const isImportingRef = useRef(false);
	// Fingerprint of the audio file we've already kicked offline analysis
	// for, so we don't re-analyze on every re-snapshot.
	const analyzedKeyRef = useRef<string | null>(null);

	useEffect(() => {
		console.log("[vizzy-auto-import] effect fired", {
			hasProject: !!activeProject,
			projectId: activeProject?.metadata?.id,
			audioMedia: audioMedia
				? { name: audioMedia.name, hasBlob: !!audioMedia.blobUrl }
				: null,
			videoQueueLen: videoQueue.length,
			alreadyImporting: isImportingRef.current,
			importedKeys: importedRef.current.size,
		});

		if (!activeProject) return;
		if (isImportingRef.current) return;

		const pending: Array<{ key: string; file: () => Promise<File | null> }> = [];

		if (audioMedia && audioMedia.blobUrl) {
			const key = fingerprint("audio", audioMedia.name, audioMedia.blobUrl);
			if (!importedRef.current.has(key)) {
				pending.push({
					key,
					file: () => fetchBlobToFile(audioMedia.blobUrl, audioMedia.name, audioMedia.mime),
				});
			}

			// Kick offline analysis for this audio file (once per fingerprint).
			// Runs in parallel with the import — analysis takes a few seconds
			// but doesn't block the user from manipulating clips.
			if (analyzedKeyRef.current !== key) {
				analyzedKeyRef.current = key;
				void (async () => {
					const file = await fetchBlobToFile(
						audioMedia.blobUrl,
						audioMedia.name,
						audioMedia.mime,
					);
					if (!file) return;
					analyzeAndStoreCurve(file, { key });
				})();
			}
		}

		for (const item of videoQueue) {
			if (item.kind !== "blob") continue; // skip youtube + remote for now
			const key = fingerprint("video", item.name, item.blobUrl);
			if (importedRef.current.has(key)) continue;
			pending.push({
				key,
				file: () => fetchBlobToFile(item.blobUrl, item.name, item.mime),
			});
		}

		console.log("[vizzy-auto-import] pending:", pending.map((p) => p.key));
		if (pending.length === 0) return;

		(async () => {
			isImportingRef.current = true;
			try {
				const files: File[] = [];
				const keysForFiles: string[] = [];
				for (const p of pending) {
					const f = await p.file();
					if (f) {
						files.push(f);
						keysForFiles.push(p.key);
					}
				}
				if (files.length === 0) return;

				console.log("[vizzy-auto-import] importing", files.length, "file(s) into project");
				const processed = await processMediaAssets({
					files,
					onProgress: () => {},
				});

				for (const asset of processed) {
					await editor.media.addMediaAsset({
						projectId: activeProject.metadata.id,
						asset,
					});
				}

				// Mark imported only after success so a transient failure leaves
				// the item eligible for retry on next snapshot.
				for (const key of keysForFiles) importedRef.current.add(key);

				toast.success(
					files.length === 1
						? `Imported "${files[0].name}" from Vizzy`
						: `Imported ${files.length} items from Vizzy`,
				);
			} catch (err) {
				console.error("[vizzy-auto-import] failed", err);
				toast.error("Couldn't import media from Vizzy", {
					description: err instanceof Error ? err.message : "Unknown error",
				});
			} finally {
				isImportingRef.current = false;
			}
		})();
	}, [activeProject, audioMedia, videoQueue, editor]);

	return null;
}

function fingerprint(kind: string, name: string, blobUrl: string): string {
	return `${kind}::${name}::${blobUrl}`;
}

async function fetchBlobToFile(
	blobUrl: string,
	name: string,
	mime?: string,
): Promise<File | null> {
	try {
		const resp = await fetch(blobUrl);
		if (!resp.ok) {
			console.warn("[vizzy-auto-import] blob fetch failed", blobUrl, resp.status);
			return null;
		}
		const blob = await resp.blob();
		const type = mime || blob.type || guessMimeFromName(name);
		return new File([blob], name, { type });
	} catch (err) {
		console.warn("[vizzy-auto-import] blob fetch threw", err);
		return null;
	}
}

function guessMimeFromName(name: string): string {
	const ext = name.split(".").pop()?.toLowerCase() ?? "";
	const map: Record<string, string> = {
		mp3: "audio/mpeg",
		wav: "audio/wav",
		m4a: "audio/mp4",
		aac: "audio/aac",
		flac: "audio/flac",
		ogg: "audio/ogg",
		opus: "audio/opus",
		aiff: "audio/aiff",
		aif: "audio/aiff",
		mp4: "video/mp4",
		m4v: "video/mp4",
		mov: "video/quicktime",
		webm: "video/webm",
		mkv: "video/x-matroska",
		avi: "video/x-msvideo",
	};
	return map[ext] ?? "application/octet-stream";
}
