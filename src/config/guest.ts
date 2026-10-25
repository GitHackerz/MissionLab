/** Guest play: anyone can try the mission without an account for a limited time. */
export const GUEST_MINUTES = 10;
export const GUEST_LIMIT_MS = GUEST_MINUTES * 60 * 1000;

/** Cookie holding the guest's first-visit timestamp (ms). Refreshing the page does not reset it. */
export const GUEST_COOKIE = 'ml_guest_start';
export const SESSION_COOKIE = 'ml_session';
