import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'

// The installed @tanstack/start-plugin-core dev and preview server adapters
// both call `serverEntry.default.fetch(request)`, but createStartHandler()
// returns a bare request-handler function, not a `{ fetch }` object. Wrap it
// to match what the adapters actually call.
const handler = createStartHandler(defaultStreamHandler)

export default { fetch: handler }
