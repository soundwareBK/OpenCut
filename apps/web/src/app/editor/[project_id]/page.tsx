// Vizzy fork: this is the server-component wrapper around the editor.
// Its only job is to declare `generateStaticParams` so the dynamic
// [project_id] segment can be statically exported. The real UI lives in
// the sibling `editor-shell.tsx` client component (which uses hooks).
//
// We pre-generate a single "default" project at build time. Project
// selection within the editor is handled at runtime via the editor's
// own project store (IndexedDB-backed by upstream OpenCut).

import EditorShell from "./editor-shell";

export function generateStaticParams() {
	return [{ project_id: "default" }];
}

// Static export needs every page reachable via a known param list; we
// don't want Next to try resolving unknown ids at runtime.
export const dynamicParams = false;

export default function Page() {
	return <EditorShell />;
}
