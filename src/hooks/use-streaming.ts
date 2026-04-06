import { useState } from "react";

export function useStreaming() {
  const [streamBuffer, setStreamBuffer] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Initializing...");

  return { streamBuffer, setStreamBuffer, loading, setLoading, status, setStatus };
}
