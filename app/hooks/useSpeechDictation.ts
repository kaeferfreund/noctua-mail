"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLatestRef } from "./useLatestRef";

// The Web Speech API's recognizer is not in TypeScript's DOM lib; its events are.
type SpeechRecognitionLike = EventTarget & {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

/** Chromium and Safari expose the recognizer (Safari and older Chromium only with the webkit prefix); Firefox does not. */
export function speechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export type SpeechDictationError = "not-allowed" | "no-speech" | "network" | "failed";

function dictationError(code: string): SpeechDictationError | null {
  if (code === "aborted") return null;
  if (code === "not-allowed" || code === "service-not-allowed") return "not-allowed";
  if (code === "no-speech" || code === "network") return code;
  return "failed";
}

/**
 * One utterance per start (`continuous` false): interim text while speaking,
 * the final text goes to `onFinal`. Stops on unmount.
 */
export function useSpeechDictation({ lang, onFinal }: { lang: string; onFinal: (text: string) => void }) {
  const [supported] = useState(() => speechRecognitionConstructor() !== null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<SpeechDictationError | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = useLatestRef(onFinal);

  const start = useCallback(() => {
    const Recognition = speechRecognitionConstructor();
    if (!Recognition || recognitionRef.current) return;
    const recognition = new Recognition();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]!;
        if (result.isFinal) finalText += result[0]?.transcript ?? "";
        else interimText += result[0]?.transcript ?? "";
      }
      if (finalText.trim()) onFinalRef.current(finalText);
      setInterim(interimText);
    };
    recognition.onerror = (event) => {
      const next = dictationError(event.error);
      if (next) setError(next);
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      recognitionRef.current = null;
      setListening(false);
      setInterim("");
    };
    setError(null);
    setInterim("");
    try {
      recognition.start();
    } catch {
      setError("failed");
      return;
    }
    recognitionRef.current = recognition;
    setListening(true);
  }, [lang, onFinalRef]);

  // stop() still delivers the final result of what was said so far.
  const stop = useCallback(() => { recognitionRef.current?.stop(); }, []);
  const toggle = useCallback(() => { if (recognitionRef.current) stop(); else start(); }, [start, stop]);

  useEffect(() => () => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    recognition?.abort();
  }, []);

  return { supported, listening, interim, error, toggle };
}
