"use client";

import { useState } from "react";
import Link from "next/link";
import { keepKeyboardOpenOnTap } from "@/lib/touch-tap";
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH, MAX_EMAIL_LENGTH } from "@/lib/constants";
import AuthLayout from "@/components/auth/AuthLayout";
import styles from "@/components/auth/Auth.module.css";

const MIN_USERNAME_LENGTH = 3;

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      // Log in straight after registering.
      const { signIn } = await import("next-auth/react");
      await signIn("credentials", {
        username,
        password,
        redirectTo: "/dashboard",
      });
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Create account">
      <form onSubmit={handleSubmit} className={styles.form}>
        <div>
          <label className="form-label" htmlFor="register-username">Username</label>
          <input
            id="register-username"
            className="form-input"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            minLength={MIN_USERNAME_LENGTH}
            required
            autoComplete="username"
          />
        </div>
        <div>
          <label className="form-label" htmlFor="register-email">Email</label>
          <input
            id="register-email"
            className="form-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={MAX_EMAIL_LENGTH}
            required
            autoComplete="email"
          />
          <p className="form-hint">We send a confirmation link. Once confirmed you can log in with it and reset your password by email.</p>
        </div>
        <div>
          <label className="form-label" htmlFor="register-password">Password</label>
          <input
            id="register-password"
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
        <button type="submit" className={`btn btn-primary ${styles.submit}`} disabled={loading} onPointerDown={keepKeyboardOpenOnTap}>
          {loading ? "Creating…" : "Create account"}
        </button>
        <p className={styles.switch}>
          By creating an account you agree to the <Link href="/terms">terms</Link> and confirm you&apos;re 16 or older.
          Read how your data is used in the <Link href="/privacy">privacy policy</Link>.
        </p>
        <p className={styles.switch}>
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
