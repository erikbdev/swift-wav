# SwiftWAVWeb

`SwiftWAVWeb` is the Vue/Vite frontend. Keep web-only organization inside
this directory; the SwiftPM targets are independent.

## Layout

- `components/` — Vue components. Components render templates, accept props,
  and emit user intent; they do not construct workers or own persistence.
- `composables/` — reusable Vue state and lifecycle (`useWorkspace`,
  `useCodeMirror`, and `useSwiftCompiler`).
- `services/` — browser service boundaries, such as worker request/response
  correlation.
- `utils/` — pure helpers for diagnostics, editor configuration, and storage.
- `workers/` — worker entrypoints and worker-only support modules. Workers
  communicate with services using serializable messages and never import Vue.

## Worker conventions

Use the `*.worker.js` suffix for entrypoints. Construct workers only in a
service or composable with Vite's module URL form:

```js
new Worker(new URL("../workers/example.worker.js", import.meta.url), {
  type: "module",
});
```

Keep the UI-facing protocol in the corresponding service. The compiler worker
is `swift-compiler.worker.js`; the audio engine boundary is reserved in
`wav-engine.worker.js`.
