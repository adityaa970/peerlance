/** Roles a user is allowed to pick for themselves. 'admin' can only be granted in the database. */
export const SELF_ASSIGNABLE_ROLES = ['poster', 'writer'] as const;
export type SelfAssignableRole = (typeof SELF_ASSIGNABLE_ROLES)[number];

/**
 * Turn a client-supplied role (e.g. from Clerk unsafeMetadata, which the app can edit)
 * into a safe one. Anything that isn't 'poster' or 'writer' falls back to `fallback`.
 */
export function safeRole(value: unknown, fallback: SelfAssignableRole = 'poster'): SelfAssignableRole {
  return SELF_ASSIGNABLE_ROLES.includes(value as SelfAssignableRole)
    ? (value as SelfAssignableRole)
    : fallback;
}
