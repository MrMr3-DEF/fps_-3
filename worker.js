async function isRateLimited(request) {
    const ip = request.headers.get("CF-Connecting-IP") || "local";
    const cacheKey = new Request(`https://rate-limit.local/ip/${ip}`);
    
    try {
        const cache = caches.default;
        let response = await cache.match(cacheKey);
        let count = 0;

        if (response) {
            const data = await response.json();
            count = data.count || 0;
        }

        if (count >= 5) {
            return true; // Limit: 5 requests per minute per IP
        }

        const newCount = count + 1;
        const cacheResponse = new Response(JSON.stringify({ count: newCount }), {
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=60" // Expire record after 60 seconds
            }
        });
        
        await cache.put(cacheKey, cacheResponse);
    } catch (e) {
        console.warn("Rate limiting cache access failed (normal in local environments):", e);
    }
    return false;
}

function makeFallbackResponse(warningMessage) {
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
    async fetch(request, env) {
        const url = new URL(request.url);

        // Route to the TURN credentials generator
        if (url.pathname === "/api/turn") {
            // 1. IP-Based Rate Limiting (100% free protection)
            const limited = await isRateLimited(request);
            if (limited) {
                return new Response(
                    JSON.stringify({ error: "Too many requests. Please wait a minute." }),
                    { status: 429, headers: { "Content-Type": "application/json" } }
                );
            }

            // 2. Validate Room Parameter (Prevents generic crawlers from spamming/abusing the endpoint)
            const room = url.searchParams.get("room");
            const roomPattern = /^[A-Z2-9]{4}$/; // Matches 4-character room codes (alphanumeric)
            if (!room || !roomPattern.test(room.toUpperCase())) {
                return new Response(
                    JSON.stringify({ error: "Invalid or missing room parameter. TURN generation is only allowed for active game rooms." }),
                    { status: 400, headers: { "Content-Type": "application/json" } }
                );
            }

            const TURN_KEY_ID = env.TURN_KEY_ID;
            const TURN_KEY_API_TOKEN = env.TURN_KEY_API_TOKEN;

            // Kill switch to prevent overcharging - return fallback servers with a warning (no 503 console error)
            if (env.DISABLE_TURN === "true") {
                return makeFallbackResponse("Cloudflare TURN service disabled via kill switch. Using fallback servers.");
            }

            // If variables aren't set, return fallback servers with a warning (no 500 console error)
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
                        body: JSON.stringify({ ttl: 86400 }) // Credentials valid for 24 hours
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
                        "Cache-Control": "public, max-age=60" // Cache briefly to reduce API hits
                    }
                });
            } catch (error) {
                return makeFallbackResponse(`Failed to generate ICE servers: ${error.message}. Using fallback servers.`);
            }
        }

        // For all other requests, serve static assets from the binding
        return env.ASSETS.fetch(request);
    }
};
