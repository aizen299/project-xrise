/**
 * Split out from session.ts so the edge proxy can import the cookie name
 * without dragging in `next/headers`, which is Node-runtime only.
 */
export const SESSION_COOKIE = 'xrise_session';
