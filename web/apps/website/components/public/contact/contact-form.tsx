"use client";

import { type FormEvent, useState } from "react";
import { useTranslations } from "next-intl";

export type ContactRecipient = {
  id: string;
  label: string;
  email: string;
};

type ContactFormProps = {
  recipients: ReadonlyArray<ContactRecipient>;
};

/**
 * Institutional contact form: the user selects a recipient (Presidency or a
 * specific ministry), fills in their details and message, then clicks "Send"
 * to open their email client with all fields pre-filled via a `mailto:` link.
 *
 * No data is stored server-side — this is a pure front-end component that
 * delegates to the user's email client.
 *
 * The markup uses the ADS form primitives shipped by
 * `@codegouvaor/react-ads/main.css` (`.gov-form`, `.gov-form-field`,
 * `.gov-form-required`, `.gov-form-error` and the DSFR `fr-btn` button) — no
 * local stylesheet.
 */
export default function ContactForm({ recipients }: ContactFormProps) {
  const t = useTranslations("pages.contact.form");

  const [recipient, setRecipient] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!recipient) {
      newErrors.recipient = t("requiredField");
    }
    if (!name.trim()) {
      newErrors.name = t("requiredField");
    }
    if (!email.trim()) {
      newErrors.email = t("requiredField");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = t("invalidEmail");
    }
    if (!subject.trim()) {
      newErrors.subject = t("requiredField");
    }
    if (!message.trim()) {
      newErrors.message = t("requiredField");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const selected = recipients.find((r) => r.id === recipient);
    if (!selected) return;

    const body = [
      `Destinataire : ${selected.label}`,
      "",
      `Nom : ${name.trim()}`,
      `Adresse électronique : ${email.trim()}`,
      "",
      message.trim(),
    ].join("\n");

    const mailtoUrl = `mailto:${selected.email}?subject=${encodeURIComponent(subject.trim())}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  }

  return (
    <form className="gov-form" onSubmit={handleSubmit} noValidate>
      {/* Recipient */}
      <div className="gov-form-field">
        <label htmlFor="contact-recipient">
          {t("recipientLabel")}
          <span className="gov-form-required" aria-hidden="true">*</span>
        </label>
        <select
          id="contact-recipient"
          value={recipient}
          onChange={(e) => {
            setRecipient(e.target.value);
            if (errors.recipient) setErrors((prev) => ({ ...prev, recipient: "" }));
          }}
          aria-required="true"
          aria-invalid={!!errors.recipient}
          aria-describedby={errors.recipient ? "contact-recipient-error" : undefined}
        >
          <option value="">{t("selectRecipient")}</option>
          <option value="presidence">{t("presidency")}</option>
          <optgroup label={t("recipientLabel")}>
            {recipients
              .filter((r) => r.id !== "presidence")
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
          </optgroup>
        </select>
        {errors.recipient && (
          <p className="gov-form-error" id="contact-recipient-error" role="alert">
            {errors.recipient}
          </p>
        )}
      </div>

      {/* Name */}
      <div className="gov-form-field">
        <label htmlFor="contact-name">
          {t("nameLabel")}
          <span className="gov-form-required" aria-hidden="true">*</span>
        </label>
        <input
          id="contact-name"
          type="text"
          placeholder={t("namePlaceholder")}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors((prev) => ({ ...prev, name: "" }));
          }}
          aria-required="true"
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "contact-name-error" : undefined}
        />
        {errors.name && (
          <p className="gov-form-error" id="contact-name-error" role="alert">
            {errors.name}
          </p>
        )}
      </div>

      {/* Email */}
      <div className="gov-form-field">
        <label htmlFor="contact-email">
          {t("emailFieldLabel")}
          <span className="gov-form-required" aria-hidden="true">*</span>
        </label>
        <input
          id="contact-email"
          type="email"
          placeholder={t("emailPlaceholder")}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
          }}
          aria-required="true"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "contact-email-error" : undefined}
        />
        {errors.email && (
          <p className="gov-form-error" id="contact-email-error" role="alert">
            {errors.email}
          </p>
        )}
      </div>

      {/* Subject */}
      <div className="gov-form-field">
        <label htmlFor="contact-subject">
          {t("subjectLabel")}
          <span className="gov-form-required" aria-hidden="true">*</span>
        </label>
        <input
          id="contact-subject"
          type="text"
          placeholder={t("subjectPlaceholder")}
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            if (errors.subject) setErrors((prev) => ({ ...prev, subject: "" }));
          }}
          aria-required="true"
          aria-invalid={!!errors.subject}
          aria-describedby={errors.subject ? "contact-subject-error" : undefined}
        />
        {errors.subject && (
          <p className="gov-form-error" id="contact-subject-error" role="alert">
            {errors.subject}
          </p>
        )}
      </div>

      {/* Message */}
      <div className="gov-form-field">
        <label htmlFor="contact-message">
          {t("messageLabel")}
          <span className="gov-form-required" aria-hidden="true">*</span>
        </label>
        <textarea
          id="contact-message"
          placeholder={t("messagePlaceholder")}
          rows={8}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            if (errors.message) setErrors((prev) => ({ ...prev, message: "" }));
          }}
          aria-required="true"
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? "contact-message-error" : undefined}
        />
        {errors.message && (
          <p className="gov-form-error" id="contact-message-error" role="alert">
            {errors.message}
          </p>
        )}
      </div>

      {/* Submit */}
      <button type="submit" className="fr-btn">
        {t("sendButton")}
      </button>
    </form>
  );
}
