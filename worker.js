export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // Route to the TURN credentials generator
        if (url.pathname === "/api/turn") {
            const TURN_KEY_ID = env.TURN_KEY_ID;
            const TURN_KEY_API_TOKEN = env.TURN_KEY_API_TOKEN;

            // Kill switch to prevent overcharging
            if (env.DISABLE_TURN === "true") {
                return new Response(
                    JSON.stringify({ error: "Cloudflare TURN service disabled via kill switch." }),
                    {
                        status: 503,
                        headers: {
                            "Content-Type": "application/json"
                        }
                    }
                );
            }

            // If variables aren't set, return an error so the frontend fallback can take over
            if (!TURN_KEY_ID || !TURN_KEY_API_TOKEN) {
                return new Response(
                    JSON.stringify({
                        error: "Cloudflare TURN configuration missing. Please set TURN_KEY_ID and TURN_KEY_API_TOKEN in your environment variables."
                    }),
                    {
                        status: 500,
                        headers: {
                            "Content-Type": "application/json"
                        }
                    }
                );
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
                    return new Response(
                        JSON.stringify({ error: `Cloudflare Calls API error: ${errorText}` }),
                        {
                            status: cfResponse.status,
                            headers: {
                                "Content-Type": "application/json"
                            }
                        }
                    );
                }

                const data = await cfResponse.json();
                return new Response(JSON.stringify(data), {
                    headers: {
                        "Content-Type": "application/json",
                        "Cache-Control": "public, max-age=60" // Cache briefly to reduce API hits
                    }
                });
            } catch (error) {
                return new Response(
                    JSON.stringify({ error: `Failed to generate ICE servers: ${error.message}` }),
                    {
                        status: 500,
                        headers: {
                            "Content-Type": "application/json"
                        }
                    }
                );
            }
        }

        // For all other requests, serve static assets from the binding
        return env.ASSETS.fetch(request);
    }
};
