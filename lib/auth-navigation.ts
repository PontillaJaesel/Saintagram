let homeExitDeadline = 0;

export function beginIntentionalAuthExit(): void {
  homeExitDeadline = Date.now() + 5_000;
}

export function cancelIntentionalAuthExit(): void {
  homeExitDeadline = 0;
}

export function isIntentionalAuthExitPending(): boolean {
  return Date.now() < homeExitDeadline;
}
