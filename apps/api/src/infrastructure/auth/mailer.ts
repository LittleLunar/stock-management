import type { MailMessage, Mailer } from "@stock-management/application";

/** Dev/default transport — logs mail to stdout. */
export class ConsoleMailer implements Mailer {
  async send(message: MailMessage): Promise<void> {
    // eslint-disable-next-line no-console
    console.info("[mailer]", {
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
  }
}

export type SmtpMailerConfig = {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  from: string;
};

/**
 * Minimal SMTP sender via Node undici/fetch is not available for SMTP.
 * Placeholder that throws until a real SMTP client is wired in Task 3/6.
 * Prefer ConsoleMailer when SMTP_* is unset.
 */
export class SmtpMailer implements Mailer {
  constructor(private readonly config: SmtpMailerConfig) {}

  async send(message: MailMessage): Promise<void> {
    // Deferred: use nodemailer or similar when SMTP is configured in later tasks.
    // For Task 2, keep a clear failure so misconfiguration is obvious.
    void this.config;
    void message;
    throw new Error(
      "SmtpMailer is not implemented yet; unset SMTP_HOST to use ConsoleMailer",
    );
  }
}

export function createMailer(env: {
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SMTP_FROM?: string;
}): Mailer {
  if (!env.SMTP_HOST) {
    return new ConsoleMailer();
  }
  return new SmtpMailer({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.SMTP_FROM ?? "noreply@localhost",
  });
}
