// server/utils/timer.js
// Disable all timers globally to prevent auto-advancing phases.
// Any code calling setTimer will log and do nothing.

export const setTimer = (callback, duration) => {
  console.log(`⏳ [timer disabled] Ignored timer request (${duration}ms).`);
  // Return a "handle" that won't break clearTimeout usage
  return { __disabled: true };
};
