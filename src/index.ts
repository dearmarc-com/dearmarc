// Thin worker entry. The default export from @nehoupat/dearmarc-core is the
// full worker handler ({ fetch, scheduled }) - this file just re-exports it
// so wrangler finds a default export.
//
// To add custom pre/post hooks (logging, extra routes, custom auth), replace
// the re-export with a wrapper:
//
//   import handler from "@nehoupat/dearmarc-core";
//   import type { Env } from "@nehoupat/dearmarc-core";
//
//   export default {
//     async fetch(request, env, ctx): Promise<Response> {
//       // your pre-hook here
//       return handler.fetch!(request, env, ctx);
//     },
//     async scheduled(event, env, ctx): Promise<void> {
//       return handler.scheduled!(event, env, ctx);
//     },
//   } satisfies ExportedHandler<Env>;

export { default } from "@nehoupat/dearmarc-core";
