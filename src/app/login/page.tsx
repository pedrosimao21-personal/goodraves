"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { keepKeyboardOpenOnTap } from "@/lib/touch-tap";
import AuthLayout from "@/components/auth/AuthLayout";
import styles from "@/components/auth/Auth.module.css";

const MIN_USERNAME_LENGTH = 3;
const MIN_PASSWORD_LENGTH = 6;

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (username.length < MIN_USERNAME_LENGTH) {
      setError(`Username or email must be at least ${MIN_USERNAME_LENGTH} characters`);
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }

    setLoading(true);

    try {
      await signIn("credentials", {
        username,
        password,
        redirectTo: "/dashboard",
      });
      // signIn with redirect won't return on success
    } catch {
      setError("Invalid username, email or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Log in">
      <form onSubmit={handleSubmit} className={styles.form}>
        <div>
          <label className="form-label" htmlFor="login-username">Username or email</label>
          <input
            id="login-username"
            className="form-input"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={MIN_USERNAME_LENGTH}
            autoComplete="username"
          />
        </div>
        <div>
          <label className="form-label" htmlFor="login-password">Password</label>
          <input
            id="login-password"
            className="form-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="current-password"
          />
          <p className="form-hint"><Link href="/forgot-password">Forgot your password?</Link></p>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className={`btn btn-primary ${styles.submit}`} disabled={loading} onPointerDown={keepKeyboardOpenOnTap}>
          {loading ? "Logging in…" : "Log in"}
        </button>
        <p className={styles.switch}>
          No account yet? <Link href="/register">Create one</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
