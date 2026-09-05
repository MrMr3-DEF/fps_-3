import { registerHooks } from 'node:module';
registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier === 'peerjs') return nextResolve(new URL('./fakePeer.ts', import.meta.url).href, context);
        if (specifier === './world.js' && context.parentURL?.endsWith('/physics.ts')) return nextResolve(new URL('./physicsWorld.ts', import.meta.url).href, context);
        try { return nextResolve(specifier, context); }
        catch (error) {
            if (specifier.startsWith('.') && specifier.endsWith('.js') && context.parentURL?.startsWith('file:')) {
                return nextResolve(specifier.slice(0, -3) + '.ts', context);
            }
            throw error;
        }
    }
});
