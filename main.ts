import { Context, Next } from "hono";
import { getConnInfo } from "hono/cloudflare-workers";

/**
 * ZebraCrossing - A rate-limiting middleware for Hono using Deno KV for storage.
 *
 * @author https://github.com/kiritocode1
 * @license MIT
 *
 * @param {Object} options - Configuration options for the rate limiter.
 * @param {number} options.windowMs - The time window in milliseconds for rate-limiting.
 * @param {number} options.maxRequests - The maximum number of requests allowed within the time window.
 *
 * @example
 * import { Hono } from "hono";
 * import { ZebraCrossing } from "./middleware/zebraCrossing.js";
 *
 * const app = new Hono();
 * app.use(
 *   "*",
 *   ZebraCrossing({ windowMs: 60000, maxRequests: 10 }) // 10 requests per minute
 * );
 *
 * app.get("/", (c) => c.text("Hello, world!"));
 * app.fire();// or do whatever you want with the app :) lol 
 *
 * @returns {Function} - A middleware function that enforces rate limits based on client IP.
 */
export const ZebraCrossing = (options: { windowMs: number; maxRequests: number }) => {
	const { windowMs, maxRequests } = options;

	return async (c: Context, next: Next) => {
		// Open a connection to Deno KV
		const kv = await Deno.openKv();

		// Get connection information (e.g., remote address)
		const { remote } = getConnInfo(c);

		// Determine the unique key for the client
		const clientIp = c.req.header("x-real-ip") || c.req.header("x-forwarded-for") || remote.address;

		const key = [`rate-limit:${clientIp}`];

		// Fetch the current rate-limit record from Deno KV
		const record = await kv.get<{ hits: number; expiresAt: number }>(key);
		const currentTime = Date.now();

		// Initialize hits and expiration time
		let hits = 0;
		let expiresAt = currentTime + windowMs;

		// If a record exists, update hits and check expiration
		if (record.value) {
			hits = record.value.hits;
			expiresAt = record.value.expiresAt;

			if (currentTime > expiresAt) {
				hits = 0;
				expiresAt = currentTime + windowMs;
			}
		}

		// Increment the hit count
		hits++;

		// If hits exceed the max allowed, block the request
		if (hits > maxRequests) {
			const resetTime = new Date(expiresAt).toISOString();
			c.res.headers.set("X-RateLimit-Limit", maxRequests.toString());
			c.res.headers.set("X-RateLimit-Remaining", "0");
			c.res.headers.set("X-RateLimit-Reset", resetTime);
			return c.text("Too Many Requests", 429);
		}

		// Save the updated record in Deno KV
		await kv.set(key, { hits, expiresAt });

		// Set rate limit headers
		c.res.headers.set("X-RateLimit-Limit", maxRequests.toString());
		c.res.headers.set("X-RateLimit-Remaining", (maxRequests - hits).toString());
		c.res.headers.set("X-RateLimit-Reset", new Date(expiresAt).toISOString());

		// Call the next middleware or handler
		await next();
	};
};
