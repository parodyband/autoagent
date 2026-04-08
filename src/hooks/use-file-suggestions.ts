import { useState, useCallback, useRef, useEffect } from "react";
import { buildRepoMap, fuzzySearch, type RepoMap } from "../tree-sitter-map.js";
import { execSync } from "child_process";
import { extractFileQuery, getFileSuggestions } from "../tui.js";

interface UseFileSuggestionsOpts {
  workDir: string;
  setInput: (updater: (prev: string) => string) => void;
}

export function useFileSuggestions({ workDir, setInput }: UseFileSuggestionsOpts) {
  const [fileSuggestions, setFileSuggestions] = useState<string[]>([]);
  const [fileSuggestionIdx, setFileSuggestionIdx] = useState(0);
  const repoMapRef = useRef<RepoMap | null>(null);

  // Build initial repo map
  useEffect(() => {
    try {
      const out = execSync(`git -C ${JSON.stringify(workDir)} ls-files`, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      const allFiles = out.split("\n").filter(Boolean);
      repoMapRef.current = buildRepoMap(workDir, allFiles);
    } catch { /* non-git repo — suggestions unavailable */ }
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
