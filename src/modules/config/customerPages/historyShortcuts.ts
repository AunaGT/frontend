import { isEditingText } from "./editorState";
export function handlePortalHistoryKey(
  event: KeyboardEvent,
  travel: (redo: boolean) => void,
) {
  if (
    event.defaultPrevented ||
    event.isComposing ||
    event.altKey ||
    !(event.ctrlKey || event.metaKey)
  )
    return;
  if (
    isEditingText(event.target as HTMLElement) ||
    event.composedPath().some((target) => isEditingText(target as HTMLElement))
  )
    return;
  const key = event.key.toLowerCase();
  if (key !== "z" && key !== "y") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  travel(key === "y" || !!event.shiftKey);
}
export function bindPortalHistoryKeys(
  target: EventTarget,
  travel: (redo: boolean) => void,
) {
  const listener = (event: Event) =>
    handlePortalHistoryKey(event as KeyboardEvent, travel);
  target.addEventListener("keydown", listener, { capture: true });
  return () =>
    target.removeEventListener("keydown", listener, { capture: true });
}
