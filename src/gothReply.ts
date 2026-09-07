/** Hide model thinking blocks, including tags split across streamed tokens. */
export function visibleGothReply(raw: string): string {
    let visible = raw.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, '').replace(/<\/think>/g, '');
    for (const tag of ['<think>', '</think>']) {
        for (let length = 1; length < tag.length; length++) {
            if (visible.endsWith(tag.slice(0, length))) {
                visible = visible.slice(0, -length);
                break;
            }
        }
    }
    return visible.trim();
}
