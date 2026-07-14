/**
 * Copy text to the clipboard, resilient to non-secure contexts.
 *
 * `navigator.clipboard` only exists in a secure context (HTTPS or localhost).
 * When the app is opened over a LAN IP (http://10.0.x.x:3000) or inside an
 * embedded webview like the VSCode Simple Browser, that API is missing and the
 * modern path throws. Fall back to a hidden <textarea> + execCommand("copy"),
 * which works in those contexts. Returns true on success.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }

  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    // Keep it out of view and unfocusable in layout, but still selectable.
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
