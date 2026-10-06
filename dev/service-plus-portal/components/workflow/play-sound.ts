/** Soft tones for the status map's path playback, synthesised with the Web Audio API so there is no
 *  audio file to ship. Browsers only allow sound after a user gesture, so `unlockSound` is called
 *  from the click that starts a path; later steps fire from a timer and reuse the unlocked context. */

const MUTE_KEY = "sp-workflow-muted";

let context: AudioContext | null = null;

export function unlockSound() {
	if (typeof window === "undefined") return;
	context ??= new AudioContext();
	if (context.state === "suspended") void context.resume();
}

// A sine note with a quick attack and a soft exponential tail, so it reads as a chime, not a beep.
function note(frequency: number, startIn: number, duration: number, volume: number) {
	if (!context) return;
	const start = context.currentTime + startIn;
	const oscillator = context.createOscillator();
	const gain = context.createGain();
	oscillator.type = "sine";
	oscillator.frequency.value = frequency;
	gain.gain.setValueAtTime(0.0001, start);
	gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
	gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
	oscillator.connect(gain).connect(context.destination);
	oscillator.start(start);
	oscillator.stop(start + duration + 0.05);
}

/** One soft tone per step; the last step of a path gets a rising two-note chime instead. */
export function playStepSound(last: boolean) {
	if (last) {
		note(659.25, 0, 0.45, 0.12); // E5
		note(987.77, 0.14, 0.7, 0.1); // B5
		return;
	}
	note(783.99, 0, 0.35, 0.09); // G5
}

// Mute is a per-viewer convenience, so it lives in browser storage. Storage can be unavailable
// (private mode, blocked site data); the page then simply starts unmuted.
export function readMuted(): boolean {
	try {
		return window.localStorage.getItem(MUTE_KEY) === "1";
	} catch {
		return false;
	}
}

export function writeMuted(muted: boolean) {
	try {
		window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
	} catch {
		// Not persisted; the toggle still works for this visit.
	}
}
