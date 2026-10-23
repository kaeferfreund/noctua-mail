type SmtpErrorLike = {
  responseCode?: unknown;
  response?: unknown;
  rejected?: unknown;
  noctuaSenderEmail?: string;
  code?: unknown;
  command?: unknown;
  message?: unknown;
};

const SMTP_UPSTREAM_FAILURE_FLAG = "noctuaSmtpUpstreamFailure";

export type SmtpHttpError = {
  status: 422 | 502 | 504;
  rejectedAddress?: string;
  rejectedRecipients?: string[];
  smtpResponseCode?: number;
  code:
    | "smtp_sender_rejected"
    | "smtp_recipient_rejected"
    | "smtp_message_rejected"
    | "smtp_temporary_failure"
    | "smtp_configuration_error"
    | "smtp_connection_timeout"
    | "smtp_greeting_timeout"
    | "smtp_server_timeout"
    | "smtp_connection_failed";
  message: string;
};

const SMTP_CONNECTION_ERROR_CODES = new Set([
  "ECONNECTION",
  "ECONNREFUSED",
  "EDNS",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ESOCKET",
  "ETLS"
]);

export function markSmtpUpstreamFailure<T>(error: T, senderEmail?: string): T {
  if (typeof error === "object" && error !== null && Object.isExtensible(error)) {
    try {
      if (senderEmail) Object.defineProperty(error, "noctuaSenderEmail", { value: senderEmail, configurable: true });
      Object.defineProperty(error, SMTP_UPSTREAM_FAILURE_FLAG, {
        value: true,
        enumerable: false,
        configurable: true
      });
    } catch {
      // Untaggable errors remain unmapped instead of being misclassified.
    }
  }
  return error;
}

export function isSmtpUpstreamFailure(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as Record<string, unknown>)[SMTP_UPSTREAM_FAILURE_FLAG] === true
  );
}

export function getSmtpHttpError(error: unknown, senderEmail?: string): SmtpHttpError | null {
  const candidate = error as SmtpErrorLike | null | undefined;
  const code = typeof candidate?.code === "string" ? candidate.code.trim().toUpperCase() : "";
  const message = typeof candidate?.message === "string" ? candidate.message.trim() : "";
  const normalizedMessage = message.toLowerCase();
  const responseCode = typeof candidate?.responseCode === "number" ? candidate.responseCode : undefined;
  const isTimeout =
    code === "ETIMEDOUT" ||
    (!responseCode && (normalizedMessage.includes("timed out") || normalizedMessage.includes("timeout")));

  if (isTimeout) {
    if (normalizedMessage.includes("connection timeout")) {
      return {
        status: 504,
        code: "smtp_connection_timeout",
        message:
          "Timed out while connecting to the outgoing mail server. Check the SMTP server and firewall settings, then try again."
      };
    }
    if (normalizedMessage.includes("greeting never received")) {
      return {
        status: 504,
        code: "smtp_greeting_timeout",
        message:
          "Connected to the outgoing mail server, but it did not respond in time. Try again later."
      };
    }
    return {
      status: 504,
      code: "smtp_server_timeout",
      message:
        "The outgoing mail server stopped responding while sending. Delivery status may be uncertain; check Sent before retrying."
    };
  }

  const command = typeof candidate?.command === "string" ? candidate.command.toUpperCase() : "";
  const response = typeof candidate?.response === "string" ? candidate.response.toLowerCase() : normalizedMessage;
  const email = senderEmail ?? candidate?.noctuaSenderEmail;
  if (responseCode && responseCode >= 400 && responseCode < 500) {
    return { status: 502, code: "smtp_temporary_failure", smtpResponseCode: responseCode,
      message: "The outgoing mail server temporarily rejected the message. Try again later." };
  }
  if (code === "EAUTH") return { status: 502, code: "smtp_configuration_error",
    message: "The outgoing mail server rejected the mailbox authentication. Ask a mailbox manager to review its SMTP configuration." };
  if (responseCode && responseCode >= 500 && responseCode < 600 && ["EENVELOPE", "EMESSAGE"].includes(code)) {
    // Sender authorization can be deferred to RCPT or DATA. Match that before recipient errors.
    const senderRejected = command.startsWith("MAIL FROM") ||
      /(?:sender|send[ -]?as|from address|mail from).*(?:reject|denied|not (?:allowed|owned|authorized|permitted)|unauthori[sz]ed|mismatch|does not (?:belong|match))|(?:not (?:allowed|authorized|permitted)|cannot|may not).*send.*(?:as|from)|(?:not owned by|sender address rejected)/i.test(response);
    if (senderRejected && email) return { status: 422, code: "smtp_sender_rejected", rejectedAddress: email,
      smtpResponseCode: responseCode, message: `The mail server rejected ${email} as a sender for this mailbox. Check its alias configuration or choose another identity.` };
    if (command.startsWith("RCPT TO")) return { status: 422, code: "smtp_recipient_rejected", smtpResponseCode: responseCode,
      rejectedRecipients: Array.isArray(candidate?.rejected) ? candidate.rejected.filter((value): value is string => typeof value === "string" && value.length <= 254 && !/[\r\n]/.test(value)).slice(0, 32) : [],
      message: "The mail server rejected one or more recipients. Review the recipient addresses." };
    return { status: 422, code: "smtp_message_rejected", smtpResponseCode: responseCode,
      message: "The mail server rejected this message. Review its content and attachments." };
  }

  if (SMTP_CONNECTION_ERROR_CODES.has(code)) {
    return {
      status: 502,
      code: "smtp_connection_failed",
      message:
        "Could not connect securely to the outgoing mail server. Check the SMTP server settings and try again."
    };
  }

  return null;
}
