/** TTS readback using the Web Speech API. */

let enabled = false;

export function stopReadback(): void {
  if (typeof speechSynthesis !== "undefined") {
    speechSynthesis.cancel();
  }
}

export function toggleReadback(): boolean {
  enabled = !enabled;
  if (!enabled) stopReadback();
  return enabled;
}

export function isReadbackEnabled(): boolean {
  return enabled;
}

export function speakText(text: string): void {
  if (!enabled || typeof speechSynthesis === "undefined" || !text.trim()) return;
  stopReadback();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.1;
  speechSynthesis.speak(utterance);
}
