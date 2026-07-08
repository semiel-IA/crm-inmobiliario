export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

/**
 * Transactional email sender abstraction. See ADR-005: there is no Resend/SMTP account yet
 * (Regla $0 — requires the user to register one), so the invitation flow never depends on this
 * actually delivering mail; it only logs, and the invitation link is the real distribution
 * channel (copied and shared manually, e.g. via WhatsApp).
 */
export interface EmailSender {
  send(input: SendEmailInput): Promise<void>;
}

/**
 * Default `EmailSender`: logs the message to the server console instead of sending it. Swap for a
 * real driver (Resend, etc.) once an account exists — no caller needs to change, they only depend
 * on the `EmailSender` interface.
 */
export class ConsoleEmailSender implements EmailSender {
  async send(input: SendEmailInput): Promise<void> {
    console.log(`[email:console] Para: ${input.to} | Asunto: ${input.subject}\n${input.html}`);
  }
}

/** Factory so callers/services can depend on this without hard-coding the concrete driver. */
export function createDefaultEmailSender(): EmailSender {
  return new ConsoleEmailSender();
}
