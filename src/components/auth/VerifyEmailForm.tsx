"use client";

import { useState } from "react";
import Link from "next/link";
import { postJson } from "./post-json";
import styles from "./Auth.module.css";

/** A button, not an automatic request: mail scanners open links in advance and would use the single-use token up. */
export default function VerifyEmailForm({ token }: { token: string }) {
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);

  async function handleConfirm() {
    setError("");
    setIsLoading(true);
    const result = await postJson("/api/email/verify", { token });
    setIsLoading(false);
    if (result.isOk) setIsDone(true);
    else setError(result.error ?? "");
  }

  if (isDone) {
    return (
      <div className={styles.form}>
        <p role="status">Your email is confirmed. You can now log in with it and reset your password by email.</p>
        <Link href="/profile" className={`btn btn-primary ${styles.submit}`}>Go to your profile</Link>
      </div>
    );
  }

  return (
    <div className={styles.form}>
      <p>Press the button to confirm this email address for your Goodraves account.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="button" className={`btn btn-primary ${styles.submit}`} disabled={isLoading || !token} onClick={handleConfirm}>
        {isLoading ? "Confirming…" : "Confirm email"}
      </button>
    </div>
  );
}
