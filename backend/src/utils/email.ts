import { resolve4, resolve6, resolveMx } from "node:dns/promises";

import { HttpError } from "./httpError";

const blockedEmailDomains = new Set([
  "example.com",
  "example.org",
  "example.net",
  "test.com",
  "fake.com",
  "mailinator.com",
  "tempmail.com",
  "10minutemail.com",
]);

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timerId = setTimeout(() => {
      reject(new Error("DNS lookup timed out"));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timerId);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timerId);
        reject(error);
      });
  });
}

function getEmailDomain(email: string) {
  const [localPart, domain, extra] = email.toLowerCase().split("@");

  if (!localPart || !domain || extra) {
    throw new HttpError(400, "Please enter a valid email address");
  }

  if (localPart.length < 4) {
    throw new HttpError(400, "Please enter your complete email address");
  }

  if (
    localPart.length > 64 ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..")
  ) {
    throw new HttpError(400, "Please enter a valid email address");
  }

  if (
    blockedEmailDomains.has(domain) ||
    !domain.includes(".") ||
    domain.includes("..")
  ) {
    throw new HttpError(400, "Please enter a real email address");
  }

  const labels = domain.split(".");
  const topLevelDomain = labels.at(-1) || "";

  if (
    topLevelDomain.length < 2 ||
    !/^[a-z]+$/.test(topLevelDomain) ||
    labels.some((label) => !label || label.startsWith("-") || label.endsWith("-"))
  ) {
    throw new HttpError(400, "Please enter a valid email address");
  }

  return domain;
}

async function hasResolvableEmailDomain(domain: string) {
  const mxRecords = await withTimeout(resolveMx(domain), 3000).catch(() => []);

  if (mxRecords.length > 0) {
    return true;
  }

  const addressRecords = await withTimeout(
    Promise.allSettled([resolve4(domain), resolve6(domain)]),
    3000
  ).catch(() => []);

  return addressRecords.some(
    (result) => result.status === "fulfilled" && result.value.length > 0
  );
}

export async function validateTravellerEmailAddress(email: string) {
  const domain = getEmailDomain(email);
  const canReceiveEmail = await hasResolvableEmailDomain(domain);

  if (!canReceiveEmail) {
    throw new HttpError(
      400,
      "Email domain could not be verified. Please check the email address."
    );
  }
}
