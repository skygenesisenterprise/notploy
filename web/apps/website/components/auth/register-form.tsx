"use client";

import * as React from "react";
import { Input } from "@codegouvaor/react-ads/Input";
import { PasswordInput } from "@codegouvaor/react-ads/blocks/PasswordInput";
import { Button } from "@codegouvaor/react-ads/Button";
import { useAuth } from "@/context/AuthContext";

export default function RegisterForm() {
  const { register, isLoading } = useAuth();

  const [displayName, setDisplayName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const nameId = React.useId();
  const emailId = React.useId();
  const passwordId = React.useId();
  const confirmId = React.useId();

  function clearError() {
    if (error) setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!displayName.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (!password) {
      setError("Please choose a password.");
      return;
    }

    if (password.length < 8) {
      setError("Your password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      await register({ displayName: displayName.trim(), email, password });
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

      {/* Name */}
      <Input
        id={nameId}
        label="Full name"
        hintText="The name displayed on your profile."
        nativeInputProps={{
          type: "text",
          autoComplete: "name",
          autoFocus: true,
          value: displayName,
          onChange: (e) => {
            setDisplayName(e.target.value);
            clearError();
          },
          disabled: isSubmitting || isLoading,
        }}
      />

      {/* Email */}
      <Input
        id={emailId}
        label="Email address"
        hintText="You will use this address to sign in."
        nativeInputProps={{
          type: "email",
          autoComplete: "email",
          value: email,
          onChange: (e) => {
            setEmail(e.target.value);
            clearError();
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
          autoComplete: "new-password",
          value: password,
          onChange: (e) => {
            setPassword(e.target.value);
            clearError();
          },
          disabled: isSubmitting || isLoading,
        }}
      />

      {/* Confirm password */}
      <PasswordInput
        id={confirmId}
        label="Confirm password"
        hintText=""
        messagesHint=""
        nativeInputProps={{
          autoComplete: "new-password",
          value: confirmPassword,
          onChange: (e) => {
            setConfirmPassword(e.target.value);
            clearError();
          },
          disabled: isSubmitting || isLoading,
        }}
      />

      {/* Submit */}
      <div>
        <Button
          type="submit"
          priority="primary"
          size="large"
          disabled={isSubmitting || isLoading}
          iconId={
            isSubmitting ? "fr-icon-refresh-line" : "fr-icon-user-add-line"
          }
          iconPosition="left"
        >
          {isSubmitting ? "Creating account…" : "Create account"}
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

      {/* Login link */}
      <div style={{ textAlign: "center" }}>
        <p style={{ margin: "0", fontSize: "0.9375rem" }}>
          Already have an account?{" "}
          <a href="/login" style={{ fontWeight: 600, textUnderlineOffset: "0.15em" }}>
            Sign in
          </a>
        </p>
      </div>
    </form>
  );
}
