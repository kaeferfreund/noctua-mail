/** Shared domain error without database/worker dependencies (also used by calendar helpers). */
export class SenderIdentityError extends Error {
  constructor(public code: string, public status: number, message: string) { super(message); }
}
