"use client";

import * as React from "react";
import { Input } from "@codegouvaor/react-ads/Input";
import { PasswordInput } from "@codegouvaor/react-ads/blocks/PasswordInput";
import { Button } from "@codegouvaor/react-ads/Button";
import { Checkbox } from "@codegouvaor/react-ads/Checkbox";
import { useAuth } from "@/context/AuthContext";

export default function LoginForm() {
  const { login, isLoading } = useAuth();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [rememberMe, setRememberMe] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const emailId = React.useId();
  const passwordId = React.useId();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setIsSubmitting(true);

    try {
      await login(email, password, rememberMe);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "An error occurred. Please try again.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
    >
      {/* Error alert */}
      {error && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "0.625rem",
            padding: "0.75rem 1rem",
            background: "color-mix(in srgb, var(--ads-color-danger) 8%, transparent)",
            border: "1px solid var(--ads-color-danger)",
            color: "var(--ads-color-danger)",
          }}
        >
          <span
            className="fr-icon-error-line"
            aria-hidden="true"
            style={{ fontSize: "1.25rem", marginTop: "0.125rem" }}
          />
          <p style={{ margin: "0", fontSize: "0.875rem", lineHeight: 1.5 }}>{error}</p>
        </div>
      )}

      {/* Email */}
      <Input
        id={emailId}
        label="Email address"
        hintText="Enter the email address linked to your account."
        nativeInputProps={{
          type: "email",
          autoComplete: "email",
          autoFocus: true,
          value: email,
          onChange: (e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          },
          disabled: isSubmitting || isLoading,
        }}
      />

      {/* Password */}
      <PasswordInput
        id={passwordId}
        label="Password"
        hintText=""
        messagesHint=""
        nativeInputProps={{
          autoComplete: "current-password",
          value: password,
          onChange: (e) => {
            setPassword(e.target.value);
            if (error) setError(null);
          },
          disabled: isSubmitting || isLoading,
        }}
      />

      {/* Remember me + forgot password */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <Checkbox
          legend={<span className="ads-sr-only">Options</span>}
          options={[
            {
              label: "Remember me",
              nativeInputProps: {
                name: "remember-me",
                checked: rememberMe,
                onChange: (e) => setRememberMe(e.target.checked),
                disabled: isSubmitting || isLoading,
              },
            },
          ]}
        />

        <a
          href="/forgot-password"
          style={{ fontSize: "0.875rem", fontWeight: 600, textUnderlineOffset: "0.15em" }}
        >
          Forgot your password?
        </a>
      </div>

      {/* Submit */}
      <div>
        <Button
          type="submit"
          priority="primary"
          size="large"
          disabled={isSubmitting || isLoading}
          iconId={
            isSubmitting ? "fr-icon-refresh-line" : "fr-icon-lock-line"
          }
          iconPosition="left"
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </div>

      {/* Divider */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <span style={{ flex: 1, height: "1px", background: "var(--ads-color-border)" }} />
        <span
          style={{
            whiteSpace: "nowrap",
            fontSize: "0.8125rem",
            color: "var(--ads-color-text-muted)",
          }}
        >
          or
        </span>
        <span style={{ flex: 1, height: "1px", background: "var(--ads-color-border)" }} />
      </div>

      {/* Register link */}
      <div style={{ textAlign: "center" }}>
        <p style={{ margin: "0", fontSize: "0.9375rem" }}>
          Don&apos;t have an account?{" "}
          <a href="/register" style={{ fontWeight: 600, textUnderlineOffset: "0.15em" }}>
            Create one
          </a>
        </p>
      </div>
    </form>
  );
}
