/** Preserve the underlying error so a GPU unload is not mistaken for a missing download. */
export function modelFailure(error: unknown): Error {
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    let explanation = '';
    if (/device.*lost|out.of.memory|GPU.*(unavailable|not available|compatible)|WebGPUNotAvailable|model.*not.*loaded|not found in loaded models|already been disposed/i.test(detail)) {
        explanation = 'The local model lost or could not obtain its WebGPU session. GPU memory limits or a driver/runtime error can cause this even with hardware acceleration enabled. This does not mean the downloaded files were deleted. If retrying fails, fully quit and reopen the browser. ';
    } else if (/quota|cache|storage/i.test(detail)) {
        explanation = 'The model could not read or write browser storage. Check available disk space and site-storage permissions. ';
    } else if (/fetch|network|download/i.test(detail)) {
        explanation = 'A model file could not be downloaded. Check the connection and retry. ';
    }
    return new Error(explanation + detail);
}
