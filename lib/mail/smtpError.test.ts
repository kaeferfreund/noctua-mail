import { describe, expect, it } from "bun:test";
import {
  getSmtpHttpError,
  isSmtpUpstreamFailure,
  markSmtpUpstreamFailure
} from "./smtpError";

describe("getSmtpHttpError", () => {
  it("maps connection timeouts to a retryable firewall-aware message", () => {
    expect(
      getSmtpHttpError({
        code: "ETIMEDOUT",
        command: "CONN",
        message: "Connection timeout"
      })
    ).toEqual({
      status: 504,
      code: "smtp_connection_timeout",
      message:
        "Timed out while connecting to the outgoing mail server. Check the SMTP server and firewall settings, then try again."
    });
  });

  it("distinguishes a missing SMTP greeting", () => {
    expect(
      getSmtpHttpError({
        code: "ETIMEDOUT",
        command: "CONN",
        message: "Greeting never received"
      })
    ).toEqual({
      status: 504,
      code: "smtp_greeting_timeout",
      message:
        "Connected to the outgoing mail server, but it did not respond in time. Try again later."
    });
  });

  it("warns that delivery may be uncertain for other SMTP timeouts", () => {
    expect(getSmtpHttpError(Object.assign(new Error("Timeout"), { code: "ETIMEDOUT" }))).toEqual({
      status: 504,
      code: "smtp_server_timeout",
      message:
        "The outgoing mail server stopped responding while sending. Delivery status may be uncertain; check Sent before retrying."
    });
  });

  it("maps non-timeout connection failures without leaking raw errors", () => {
    expect(
      getSmtpHttpError({ code: "ECONNREFUSED", message: "connect ECONNREFUSED 192.0.2.1" })
    ).toEqual({
      status: 502,
      code: "smtp_connection_failed",
      message:
        "Could not connect securely to the outgoing mail server. Check the SMTP server settings and try again."
    });
  });

  it("leaves unrelated application errors unmapped", () => {
    expect(getSmtpHttpError(new Error("database is locked"))).toBeNull();
  });

  it("safely ignores non-string error fields", () => {
    expect(getSmtpHttpError({ code: 504, message: { reason: "timeout" } })).toBeNull();
  });
});

describe("markSmtpUpstreamFailure / isSmtpUpstreamFailure", () => {
  it("tags SMTP transport errors without adding serialized fields", () => {
    const error = new Error("Connection timeout");
    expect(markSmtpUpstreamFailure(error)).toBe(error);
    expect(isSmtpUpstreamFailure(error)).toBe(true);
    expect(Object.keys(error)).toEqual([]);
    expect(JSON.stringify(error)).toBe("{}");
  });

  it("does not flag unrelated or non-extensible errors", () => {
    expect(isSmtpUpstreamFailure(new Error("database timeout"))).toBe(false);
    expect(isSmtpUpstreamFailure(markSmtpUpstreamFailure(Object.freeze(new Error("frozen"))))).toBe(
      false
    );
  });
});

for (const [name, command, response, expected] of [
  ["MAIL sender", "MAIL FROM", "553 address rejected", "smtp_sender_rejected"],
  ["deferred sender at RCPT", "RCPT TO", "553 Sender address rejected: not owned by user", "smtp_sender_rejected"],
  ["deferred sender at DATA", "DATA", "550 not allowed to send as this address", "smtp_sender_rejected"],
  ["recipient", "RCPT TO", "550 No such recipient", "smtp_recipient_rejected"],
  ["message", "DATA", "554 Message content rejected", "smtp_message_rejected"]
] as const) {
  it(`classifies ${name} without exposing provider detail`, () => {
    const mapped = getSmtpHttpError({ code: command === "DATA" ? "EMESSAGE" : "EENVELOPE", command, response,
      responseCode: 553, rejected: ["recipient@example.test"] }, "alias@example.test");
    expect(mapped).toMatchObject({ status: 422, code: expected, smtpResponseCode: 553 });
    if (expected === "smtp_sender_rejected") expect(mapped?.rejectedAddress).toBe("alias@example.test");
    if (expected === "smtp_recipient_rejected") expect(mapped?.rejectedRecipients).toEqual(["recipient@example.test"]);
    expect(mapped?.message).not.toContain(response);
  });
}
it("keeps 4xx transient and authentication config drift separate from permanent sender rejection", () => {
  expect(getSmtpHttpError({ code: "EENVELOPE", command: "MAIL FROM", responseCode: 451, response: "Sender temporarily rejected" }, "alias@example.test"))
    .toMatchObject({ status: 502, code: "smtp_temporary_failure" });
  expect(getSmtpHttpError({ code: "EAUTH", responseCode: 535, message: "synthetic credential detail" }))
    .toMatchObject({ status: 502, code: "smtp_configuration_error" });
});

it("classifies an actual SMTP 4xx timeout response as temporary rather than a socket timeout", () => {
  expect(getSmtpHttpError({ code: "EMESSAGE", command: "DATA", responseCode: 451, message: "451 Server timeout" }))
    .toMatchObject({ status: 502, code: "smtp_temporary_failure", smtpResponseCode: 451 });
});
