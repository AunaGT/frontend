import { useEffect, useRef, useState } from "react";
import { createMessageLimiter, parseSandboxMessage } from "./sandboxMessages";
export type VisualArtifact = { url: string; hash: string; channelId: string };
function validArtifact(artifact: VisualArtifact) {
  try {
    const url = new URL(artifact.url);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === "/artifacts/" + artifact.hash &&
      /^[a-f0-9]{64}$/.test(artifact.hash) &&
      /^[a-zA-Z0-9_-]{8,80}$/.test(artifact.channelId) &&
      (typeof window === "undefined" ||
        url.hostname !== window.location.hostname)
    );
  } catch {
    return false;
  }
}
export function CustomVisualFrame({
  artifact,
  enabled,
  fallbackText,
}: {
  artifact: VisualArtifact;
  enabled: boolean;
  fallbackText: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null),
    [height, setHeight] = useState(160),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    setHeight(160);
    if (!enabled || !validArtifact(artifact)) return;
    const limiter = createMessageLimiter(),
      listen = (event: MessageEvent) => {
        const message = parseSandboxMessage(event, {
          source: frame.current?.contentWindow || null,
          channelId: artifact.channelId,
          now: Date.now(),
          limiter,
        });
        if (message?.kind === "resize") setHeight(message.height);
        else if (message?.kind === "error") setFailed(true);
      };
    window.addEventListener("message", listen);
    return () => window.removeEventListener("message", listen);
  }, [artifact.url, artifact.channelId, enabled]);
  if (!enabled || failed || !validArtifact(artifact))
    return <div className="portal-custom-fallback">{fallbackText}</div>;
  return (
    <div
      style={{
        height,
        maxHeight: 800,
        minHeight: 80,
        overflow: "hidden",
        position: "relative",
        isolation: "isolate",
        contain: "layout paint",
      }}
    >
      <iframe
        ref={frame}
        src={artifact.url}
        title="Contenido visual personalizado"
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        allow="camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'; usb 'none'; serial 'none'; bluetooth 'none'"
        loading="lazy"
        onError={() => setFailed(true)}
        style={{ border: 0, width: "100%", height: "100%", display: "block" }}
      />
    </div>
  );
}
