"use client";

import { useState } from "react";
import Link from "next/link";
import { keepKeyboardOpenOnTap } from "@/lib/touch-tap";
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from "@/lib/constants";
import { postJson } from "./post-json";
import styles from "./Auth.module.css";

export default function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    const result = await postJson("/api/password-reset/confirm", { token, password });
    setIsLoading(false);
    if (result.isOk) setIsDone(true);
    else setError(result.error ?? "");
  }

  if (!token) {
    return (
      <div className={styles.form}>
        <p className="form-error" role="alert">This link is incomplete. Request a new one.</p>
        <p className={styles.switch}><Link href="/forgot-password">Request a reset link</Link></p>
      </div>
    );
  }

  if (isDone) {
    return (
      <div className={styles.form}>
        <p role="status">Your password is changed. Log in with the new one.</p>
        <Link href="/login" className={`btn btn-primary ${styles.submit}`}>Log in</Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div>
        <label className="form-label" htmlFor="reset-password">New password</label>
        <input
          id="reset-password"
          className="form-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={MIN_PASSWORD_LENGTH}
          maxLength={MAX_PASSWORD_LENGTH}
          required
          autoComplete="new-password"
        />
        <p className="form-hint">At least {MIN_PASSWORD_LENGTH} characters.</p>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" className={`btn btn-primary ${styles.submit}`} disabled={isLoading} onPointerDown={keepKeyboardOpenOnTap}>
        {isLoading ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
