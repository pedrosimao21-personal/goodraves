import bcrypt from "bcryptjs";
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from "./constants";

const BCRYPT_SALT_ROUNDS = 12;

/** User-facing reason a new password is rejected, or null when it's acceptable. Server-only (bcrypt). */
export function getPasswordError(password: unknown): string | null {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Password must be at most ${MAX_PASSWORD_LENGTH} characters`;
  }
  return null;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}
