"use client";

import { useState } from "react";
import Link from "next/link";
import { keepKeyboardOpenOnTap } from "@/lib/touch-tap";
import { MAX_EMAIL_LENGTH } from "@/lib/constants";
import { postJson } from "./post-json";
import styles from "./Auth.module.css";

/** Asks for a reset link. Always ends in the same message, whether or not the address has an account. */
export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    const result = await postJson("/api/password-reset/request", { email });
    setIsLoading(false);
    if (result.isOk) setIsSent(true);
    else setError(result.error ?? "");
  }

  if (isSent) {
    return (
      <div className={styles.form}>
        <p role="status">If that address belongs to a Goodraves account with a confirmed email, a reset link is on its way. It works for one hour.</p>
        <p className={styles.switch}><Link href="/login">Back to log in</Link></p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div>
        <label className="form-label" htmlFor="forgot-email">Email</label>
        <input id="forgot-email" className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={MAX_EMAIL_LENGTH} required autoComplete="email" />
        <p className="form-hint">Only confirmed email addresses can reset a password.</p>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" className={`btn btn-primary ${styles.submit}`} disabled={isLoading} onPointerDown={keepKeyboardOpenOnTap}>
        {isLoading ? "Sending…" : "Send reset link"}
      </button>
      <p className={styles.switch}><Link href="/login">Back to log in</Link></p>
    </form>
  );
}
