import { useState, useCallback, useRef, useEffect } from "react";
import { buildRepoMapAsync, fuzzySearch, type RepoMap } from "../tree-sitter-map.js";
import { exec } from "child_process";
import { extractFileQuery, getFileSuggestions } from "../tui.js";

interface UseFileSuggestionsOpts {
  workDir: string;
  setInput: (updater: (prev: string) => string) => void;
}

export function useFileSuggestions({ workDir, setInput }: UseFileSuggestionsOpts) {
  const [fileSuggestions, setFileSuggestions] = useState<string[]>([]);
  const [fileSuggestionIdx, setFileSuggestionIdx] = useState(0);
  const repoMapRef = useRef<RepoMap | null>(null);

  // Build initial repo map asynchronously so the event loop stays responsive
  useEffect(() => {
    const ac = new AbortController();

    exec(`git -C ${JSON.stringify(workDir)} ls-files`, { encoding: "utf8" }, (err, stdout) => {
      if (err || ac.signal.aborted) return;
      const allFiles = stdout.split("\n").filter(Boolean);
      buildRepoMapAsync(workDir, allFiles, 20, ac.signal).then(map => {
        if (!ac.signal.aborted) {
          repoMapRef.current = map;
        }
      });
    });

    return () => ac.abort();
  }, [workDir]);

  const handleInputChange = useCallback((val: string, rawSetInput: (v: string) => void) => {
    rawSetInput(val);
    const partial = extractFileQuery(val);
    if (partial !== null && repoMapRef.current) {
      const suggs = getFileSuggestions(repoMapRef.current, partial, 5);
      setFileSuggestions(suggs);
      setFileSuggestionIdx(0);
    } else {
      setFileSuggestions([]);
      setFileSuggestionIdx(0);
    }
  }, []);

  const acceptFileSuggestion = useCallback((path: string) => {
    setInput(prev => {
      const idx = prev.lastIndexOf("#");
      if (idx === -1) return prev;
      return prev.slice(0, idx) + "#" + path + " ";
    });
    setFileSuggestions([]);
    setFileSuggestionIdx(0);
  }, [setInput]);

  const dismissSuggestions = useCallback(() => {
    setFileSuggestions([]);
    setFileSuggestionIdx(0);
  }, []);

  return {
    fileSuggestions,
    fileSuggestionIdx,
    setFileSuggestionIdx,
    repoMapRef,
    handleInputChange,
    acceptFileSuggestion,
    dismissSuggestions,
  };
}
