"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./Auth.module.css";

/** A button, not an automatic request: mail scanners open links in advance and would unsubscribe the reader. */
export default function UnsubscribeForm({ token, label }: { token: string; label: string }) {
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);

  async function handleUnsubscribe() {
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch(`/api/unsubscribe?t=${encodeURIComponent(token)}`, { method: "POST" });
      if (res.ok) setIsDone(true);
      else setError("This unsubscribe link is not valid.");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (isDone) {
    return (
      <div className={styles.form}>
        <p role="status">Done. You will not get the “{label}” email any more. You can switch it back on from your profile.</p>
        <Link href="/profile" className={`btn btn-primary ${styles.submit}`}>Go to your profile</Link>
      </div>
    );
  }

  return (
    <div className={styles.form}>
      <p>Stop getting the “{label}” email from Goodraves?</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="button" className={`btn btn-primary ${styles.submit}`} disabled={isLoading} onClick={handleUnsubscribe}>
        {isLoading ? "Unsubscribing…" : "Unsubscribe"}
      </button>
    </div>
  );
}
