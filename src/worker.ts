interface Env {
    TURN_KEY_ID?: string;
    TURN_KEY_API_TOKEN?: string;
    DISABLE_TURN?: string;
    ASSETS: {
        fetch: (request: Request) => Promise<Response>;
    };
}

// Lightweight per-IP throttle for TURN credential generation. It is best-effort:
// local development and some edge failures may skip it, but the endpoint should
// still serve fallback ICE data.
async function isRateLimited(request: Request): Promise<boolean> {
    const ip = request.headers.get("CF-Connecting-IP") || "local";
    const cacheKey = new Request(`https://rate-limit.local/ip/${ip}`);
    
    try {
        const cache = (caches as unknown as { default: Cache }).default;
        let response = await cache.match(cacheKey);
        let count = 0;

        if (response) {
            const data = (await response.json()) as { count?: number } | null;
            count = data?.count || 0;
        }

        if (count >= 30) {
            return true;
        }

        const newCount = count + 1;
        const cacheResponse = new Response(JSON.stringify({ count: newCount }), {
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=60"
            }
        });
        
        await cache.put(cacheKey, cacheResponse);
    } catch (e) {
        console.warn("Rate limiting cache access failed (normal in local environments):", e);
    }
    return false;
}

// Keep this fallback list in sync with multiplayer.ts so local and deployed
// builds behave the same when Cloudflare TURN credentials are unavailable.
function makeFallbackResponse(warningMessage: string): Response {
    const fallbackData = {
        warning: warningMessage,
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun.cloudflare.com:3478' },
            {
                urls: 'turn:openrelay.metered.ca:80',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            },
            {
                urls: 'turn:openrelay.metered.ca:443',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            },
            {
                urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            }
        ]
    };
    return new Response(JSON.stringify(fallbackData), {
        status: 200,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=60"
        }
    });
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        if (url.pathname === "/api/turn") {
            const limited = await isRateLimited(request);
            if (limited) {
                return makeFallbackResponse("TURN credential rate limit reached for this minute. Using fallback servers.");
            }

            // Require a game-like room code before generating relay credentials.
            const room = url.searchParams.get("room");
            const roomPattern = /^[A-Z2-9]{4}$/;
            if (!room || !roomPattern.test(room.toUpperCase())) {
                return new Response(
                    JSON.stringify({ error: "Invalid or missing room parameter. TURN generation is only allowed for active game rooms." }),
                    { status: 400, headers: { "Content-Type": "application/json" } }
                );
            }

            const TURN_KEY_ID = env.TURN_KEY_ID;
            const TURN_KEY_API_TOKEN = env.TURN_KEY_API_TOKEN;

            // Kill switch for Cloudflare Calls usage; clients can still try fallback relays.
            if (env.DISABLE_TURN === "true") {
                return makeFallbackResponse("Cloudflare TURN service disabled via kill switch. Using fallback servers.");
            }

            if (!TURN_KEY_ID || !TURN_KEY_API_TOKEN) {
                return makeFallbackResponse("Cloudflare TURN configuration missing. Using fallback servers.");
            }

            try {
                const cfResponse = await fetch(
                    `https://rtc.live.cloudflare.com/v1/turn/keys/${TURN_KEY_ID}/credentials/generate-ice-servers`,
                    {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${TURN_KEY_API_TOKEN}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({ ttl: 86400 })
                    }
                );

                if (!cfResponse.ok) {
                    const errorText = await cfResponse.text();
                    return makeFallbackResponse(`Cloudflare Calls API error: ${errorText}. Using fallback servers.`);
                }

                const data = await cfResponse.json();
                return new Response(JSON.stringify(data), {
                    headers: {
                        "Content-Type": "application/json",
                        "Cache-Control": "public, max-age=3600"
                    }
                });
            } catch (error: any) {
                return makeFallbackResponse(`Failed to generate ICE servers: ${error.message}. Using fallback servers.`);
            }
        }

        return env.ASSETS.fetch(request);
    }
};
