import confetti from "canvas-confetti";

export function fireCelebrationConfetti() {
  const count = 200;
  const defaults = { origin: { y: 0.7 }, zIndex: 9999 };

  function fire(particleRatio: number, opts: confetti.Options) {
    confetti({ ...defaults, ...opts, particleCount: Math.floor(count * particleRatio) });
  }

  // Multi-tier champagne, amber, emerald and coral burst.
  fire(0.25, { spread: 26, startVelocity: 55, colors: ["#d97706", "#f59e0b", "#10b981", "#fbbf24", "#f43f5e"] });
  fire(0.2, { spread: 60, colors: ["#b45309", "#d97706", "#059669", "#fef3c7"] });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8, colors: ["#f59e0b", "#ec4899", "#3b82f6", "#10b981"] });
  fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2, colors: ["#fef08a", "#fde047", "#fed7aa"] });
  fire(0.1, { spread: 120, startVelocity: 45, colors: ["#d97706", "#10b981", "#f59e0b"] });
}
