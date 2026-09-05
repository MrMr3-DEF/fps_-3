/** Enforce the limit while reading, including requests without Content-Length. */
export async function parseJsonBody<T>(request: Request, limit = 4096): Promise<T | null> {
    const length = request.headers.get('Content-Length');
    if (length && (!/^\d+$/.test(length) || Number(length) > limit)) return null;
    if (!request.body) return null;
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    let timeout: ReturnType<typeof setTimeout>;
    const deadline = new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Request body timed out.')), 5000); });
    try {
        while (true) {
            const { done, value } = await Promise.race([reader.read(), deadline]);
            if (done) break;
            size += value.byteLength;
            if (size > limit) { void reader.cancel().catch(() => {}); return null; }
            chunks.push(value);
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        const result: unknown = JSON.parse(new TextDecoder().decode(bytes));
        return result !== null && typeof result === 'object' && !Array.isArray(result) ? result as T : null;
    } catch { void reader.cancel().catch(() => {}); return null; }
    finally { clearTimeout(timeout!); reader.releaseLock(); }
}
