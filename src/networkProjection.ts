/** Only validated primitive leaves may use `true`; containers must name every
 * field so an accepted packet never retains untrusted extra payload or aliases. */
export type Projection = true | { readonly [key: string]: Projection } | readonly [Projection] | ((value: unknown) => Projection);

export function isPacketRecord(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === null || prototype === Object.prototype;
}

export function fields(...names: string[]): Record<string, Projection> {
    return Object.fromEntries(names.map(name => [name, true]));
}

export const vectorFields = fields('x', 'y', 'z');
export function variant(key: string, choices: Record<string, Projection>): Projection {
    return value => choices[String((value as Record<string, unknown>)[key])];
}

export function projectKnown<T>(value: T, schema: Projection): T {
    if (value === null || value === undefined || schema === true) return value;
    if (typeof schema === 'function') return projectKnown(value, schema(value));
    if (Array.isArray(schema)) return (value as unknown[]).map(item => projectKnown(item, schema[0])) as T;
    const source = value as Record<string, unknown>, result: Record<string, unknown> = {};
    for (const key of Object.keys(schema)) {
        if (Object.hasOwn(source, key) && source[key] !== undefined) {
            result[key] = projectKnown(source[key], (schema as Record<string, Projection>)[key]);
        }
    }
    return result as T;
}
