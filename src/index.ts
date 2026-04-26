// Thin worker entry point. All logic comes from the @nehoupat/dearmarc-core
// package. This file exists so you can plug in your own pre/post hooks
// (logging, additional routes, custom auth, ...) if you ever need to.
// The default is a passthrough.

import {
  handleRequest,
  runScheduledReports,
  type Env,
} from "@nehoupat/dearmarc-core";

export default {
  async fetch(request, env, ctx): Promise<Response> {
    return handleRequest(request, env, ctx);
  },

  async scheduled(_event, env, ctx): Promise<void> {
    ctx.waitUntil(runScheduledReports(env));
  },
} satisfies ExportedHandler<Env>;
