"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { Button, ButtonArrow } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  completeGoogleTravellerProfile,
  completeTravellerProfile,
  loginTravellerWithGoogle,
  requestTravellerOtp,
  saveTravellerSession,
  verifyTravellerOtp,
} from "@/lib/auth";
import { getFirebaseAuth } from "@/lib/firebase";

type LoginStep = "mobile" | "otp";
type ProfileMode = "mobile" | "google";
const authenticatedHomePath = "/me";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function getGoogleErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "auth/popup-closed-by-user"
  ) {
    return "Google sign-in was closed before completion.";
  }

  return getErrorMessage(error);
}

function sanitizeRedirectPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return authenticatedHomePath;
  }

  if (value === "/" || value === "/login" || value.startsWith("/login?")) {
    return authenticatedHomePath;
  }

  return value;
}

function getInitialRedirectPath(): string {
  const params = new URLSearchParams(window.location.search);
  const redirectPath = sanitizeRedirectPath(params.get("redirect"));

  if (redirectPath !== "/") {
    return redirectPath;
  }

  try {
    const referrer = new URL(document.referrer);

    if (
      referrer.origin === window.location.origin &&
      referrer.pathname !== "/login"
    ) {
      return sanitizeRedirectPath(
        `${referrer.pathname}${referrer.search}${referrer.hash}`
      );
    }
  } catch {
    return "/";
  }

  return authenticatedHomePath;
}

function getDisplayMobileNumber(value: string): string {
  let digits = value.replace(/\D/g, "");

  if (digits.length > 10 && digits.startsWith("91")) {
    digits = digits.slice(2);
  }

  if (digits.length > 10 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  return digits.slice(0, 10);
}

function removeIndiaCountryCode(value: string): string {
  return getDisplayMobileNumber(value);
}

function hasValidEmailShape(email: string) {
  const trimmedEmail = email.trim().toLowerCase();
  const [localPart, domain, extra] = trimmedEmail.split("@");

  return Boolean(
    localPart &&
      domain &&
      !extra &&
      localPart.length >= 4 &&
      !localPart.startsWith(".") &&
      !localPart.endsWith(".") &&
      !localPart.includes("..") &&
      /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedEmail)
  );
}

export function TravellerLoginCard() {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<LoginStep>("mobile");
  const [mobileNumber, setMobileNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [registrationToken, setRegistrationToken] = useState("");
  const [profileMode, setProfileMode] = useState<ProfileMode>("mobile");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [isProfilePopupOpen, setIsProfilePopupOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [profileErrorMessage, setProfileErrorMessage] = useState("");
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [isCompletingProfile, setIsCompletingProfile] = useState(false);
  const [otpCooldownSeconds, setOtpCooldownSeconds] = useState(0);
  const isSubmitting = isRequestingOtp || isVerifyingOtp;

  const title = useMemo(() => {
    return step === "mobile" ? "Welcome Back!" : "Verify OTP";
  }, [step]);

  const subtitle = useMemo(() => {
    return step === "mobile"
      ? "Continue your journey with a secure mobile OTP"
      : "Enter the OTP sent to your mobile number";
  }, [step]);

  useEffect(() => {
    if (otpCooldownSeconds <= 0) {
      return;
    }

    const timerId = window.setInterval(() => {
      setOtpCooldownSeconds((seconds) => Math.max(seconds - 1, 0));
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [otpCooldownSeconds]);

  function redirectAfterAuth() {
    router.push(getInitialRedirectPath());
  }

  async function sendLoginOtp() {
    setErrorMessage("");
    setStatusMessage("");
    setIsRequestingOtp(true);

    try {
      const response = await requestTravellerOtp(mobileNumber);

      setMobileNumber(removeIndiaCountryCode(response.data.mobileNumber));
      setStep("otp");
      setOtp("");
      setOtpCooldownSeconds(60);
      setStatusMessage(response.message);
      toast.success("OTP sent", response.message);
    } catch (error) {
      const message = getErrorMessage(error);

      setErrorMessage(message);
      toast.error("Could not send OTP", message);
    } finally {
      setIsRequestingOtp(false);
    }
  }

  async function handleRequestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendLoginOtp();
  }

  async function handleResendOtp() {
    if (otpCooldownSeconds > 0) {
      return;
    }

    await sendLoginOtp();
  }

  async function handleVerifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setStatusMessage("");
    setIsVerifyingOtp(true);

    try {
      const response = await verifyTravellerOtp({
        mobileNumber,
        otp,
      });

      if (response.data.requiresProfile) {
        setMobileNumber(removeIndiaCountryCode(response.data.mobileNumber));
        setRegistrationToken(response.data.registrationToken);
        setProfileMode("mobile");
        setFirstName("");
        setLastName("");
        setEmail("");
        setIsProfilePopupOpen(true);
        setOtpCooldownSeconds(0);
        setStatusMessage(response.message);
        toast.success("OTP verified", response.message);
        return;
      }

      saveTravellerSession({
        token: response.data.token,
        user: response.data.user,
      });
      setOtpCooldownSeconds(0);
      setStatusMessage(response.message);
      toast.success("Login successful", response.message);
      redirectAfterAuth();
    } catch (error) {
      const message = getErrorMessage(error);

      setErrorMessage(message);
      toast.error("OTP verification failed", message);
    } finally {
      setIsVerifyingOtp(false);
    }
  }

  async function handleCompleteProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileErrorMessage("");

    if (profileMode === "mobile" && !hasValidEmailShape(email)) {
      const message = "Please enter a valid email address.";

      setProfileErrorMessage(message);
      toast.error("Email required", message);
      return;
    }

    setIsCompletingProfile(true);

    try {
      const response =
        profileMode === "google"
          ? await completeGoogleTravellerProfile({
              registrationToken,
              firstName,
              lastName,
              mobileNumber,
            })
          : await completeTravellerProfile({
              registrationToken,
              firstName,
              lastName,
              email: email.trim().toLowerCase(),
            });

      saveTravellerSession(response.data);
      setIsProfilePopupOpen(false);
      toast.success("Profile completed", response.message);
      redirectAfterAuth();
    } catch (error) {
      const message = getErrorMessage(error);

      setProfileErrorMessage(message);
      toast.error("Could not complete profile", message);
    } finally {
      setIsCompletingProfile(false);
    }
  }

  async function handleGoogleLogin() {
    setErrorMessage("");
    setStatusMessage("");
    setIsGoogleSubmitting(true);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: "select_account",
      });

      const result = await signInWithPopup(getFirebaseAuth(), provider);
      const idToken = await result.user.getIdToken();
      const response = await loginTravellerWithGoogle({ idToken });

      if (response.data.requiresProfile) {
        setRegistrationToken(response.data.registrationToken);
        setProfileMode("google");
        setFirstName(response.data.firstName);
        setLastName(response.data.lastName);
        setEmail(response.data.email);
        setMobileNumber(removeIndiaCountryCode(response.data.mobileNumber));
        setIsProfilePopupOpen(true);
        setStatusMessage(response.message);
        toast.success("Google verified", response.message);
        return;
      }

      saveTravellerSession(response.data);
      setStatusMessage(response.message);
      toast.success("Login successful", response.message);
      redirectAfterAuth();
    } catch (error) {
      const message = getGoogleErrorMessage(error);

      setErrorMessage(message);
      toast.error("Google sign-in failed", message);
    } finally {
      setIsGoogleSubmitting(false);
    }
  }

  function handleBackToMobile() {
    setStep("mobile");
    setOtp("");
    setRegistrationToken("");
    setProfileMode("mobile");
    setFirstName("");
    setLastName("");
    setEmail("");
    setIsProfilePopupOpen(false);
    setErrorMessage("");
    setStatusMessage("");
    setProfileErrorMessage("");
    setOtpCooldownSeconds(0);
  }

  return (
    <>
      <div className="w-full max-w-[560px] rounded-[11px] border border-white/85 bg-white/96 px-4 py-5 shadow-[0_26px_70px_rgba(50,50,50,0.16)] backdrop-blur-md sm:rounded-[13px] sm:px-[clamp(1.5rem,3.5vw,3rem)] sm:py-[clamp(1.4rem,3.5vh,2.5rem)]">
        <div className="text-center">
          <h2 className="font-heading text-[1.45rem] font-bold leading-none text-secondary sm:text-[clamp(1.55rem,3vh,1.9rem)]">
            {title}
          </h2>
          <p className="mt-2 font-sans text-[13px] leading-[1.45] text-secondary/62 sm:mt-[clamp(0.55rem,1.5vh,1rem)] sm:text-[14px]">
            {subtitle}
          </p>
        </div>

        {statusMessage ? (
          <div className="mt-4 flex items-start gap-3 rounded-[7px] border border-[#bfe5ca] bg-[#f0fbf3] px-4 py-3 font-sans text-[12px] font-medium leading-[1.45] text-[#2f7d3b] sm:mt-5">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
            <span>{statusMessage}</span>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mt-4 rounded-[7px] border border-[#f1c4bb] bg-[#fff4f1] px-4 py-3 font-sans text-[12px] font-semibold leading-[1.45] text-[#b33620] sm:mt-5">
            {errorMessage}
          </div>
        ) : null}

        {step === "mobile" ? (
          <div className="mt-5 space-y-5 sm:mt-[clamp(1.25rem,3vh,2.25rem)] sm:space-y-[clamp(1rem,2.5vh,1.75rem)]">
            <form
              className="space-y-5 sm:space-y-[clamp(1rem,2.5vh,1.75rem)]"
              onSubmit={handleRequestOtp}
            >
              <label className="block">
                <span className="font-sans text-[13px] font-bold text-secondary">
                  Phone Number
                </span>
                <span className="mt-2.5 flex h-12 items-center gap-3 rounded-[7px] border border-border bg-white px-4 text-secondary/48 shadow-[0_8px_18px_rgba(50,50,50,0.03)] transition-colors focus-within:border-primary sm:mt-3 sm:h-[clamp(3rem,6vh,3.625rem)] sm:gap-4 sm:px-5">
                  <Phone className="size-5" strokeWidth={1.8} />
                  <span className="border-r border-border pr-3 font-sans text-[14px] font-semibold text-secondary sm:pr-4">
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    value={mobileNumber}
                    onChange={(event) =>
                      setMobileNumber(getDisplayMobileNumber(event.target.value))
                    }
                    maxLength={10}
                    placeholder="Enter mobile number"
                    className="h-full min-w-0 flex-1 bg-transparent font-sans text-[14px] text-secondary outline-none placeholder:text-secondary/42"
                    required
                  />
                </span>
              </label>

              <Button
                type="submit"
                disabled={isSubmitting || isGoogleSubmitting}
                className="relative h-11 w-full min-w-0 justify-center px-5 text-[15px] font-normal sm:px-6 sm:text-button"
              >
                {isRequestingOtp ? "Sending OTP..." : "Send OTP"}
                {isRequestingOtp ? (
                  <Loader2
                    className="absolute right-5 size-4 animate-spin"
                    strokeWidth={2.2}
                  />
                ) : null}
              </Button>
            </form>

            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="font-sans text-[12px] font-semibold uppercase text-secondary/45">
                or
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting || isGoogleSubmitting}
              onClick={handleGoogleLogin}
              className="h-11 w-full justify-center gap-3 px-4 text-[15px] font-normal sm:px-5"
            >
              <span className="grid size-5 place-items-center rounded-full bg-white font-sans text-[14px] font-bold text-primary group-hover/button:text-primary">
                G
              </span>
              Continue with Google
              {isGoogleSubmitting ? (
                <Loader2 className="size-4 animate-spin" strokeWidth={2.2} />
              ) : null}
            </Button>
          </div>
        ) : (
          <form
            className="mt-5 space-y-4 sm:mt-[clamp(1.25rem,3vh,2.25rem)]"
            onSubmit={handleVerifyOtp}
          >
            <label className="block">
              <span className="font-sans text-[13px] font-bold text-secondary">
                OTP
              </span>
              <span className="mt-2.5 flex h-12 items-center gap-3 rounded-[7px] border border-border bg-white px-4 text-secondary/48 shadow-[0_8px_18px_rgba(50,50,50,0.03)] transition-colors focus-within:border-primary sm:mt-3 sm:h-[clamp(3rem,6vh,3.625rem)] sm:gap-4 sm:px-5">
                <ShieldCheck className="size-5" strokeWidth={1.8} />
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                  placeholder="Enter OTP"
                  className="h-full min-w-0 flex-1 bg-transparent font-sans text-[14px] text-secondary outline-none placeholder:text-secondary/42"
                  required
                />
              </span>
            </label>

            <div className="flex flex-col gap-3 rounded-[7px] border border-primary/15 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-sans text-[12px] font-medium leading-[1.45] text-secondary/68">
                {otpCooldownSeconds > 0
                  ? `You can resend OTP in ${otpCooldownSeconds}s.`
                  : "Did not receive the OTP?"}
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={
                  isRequestingOtp || isVerifyingOtp || otpCooldownSeconds > 0
                }
                onClick={handleResendOtp}
                className="h-10 w-full justify-center px-5 text-[13px] font-normal sm:w-auto"
              >
                {isRequestingOtp
                  ? "Sending..."
                  : otpCooldownSeconds > 0
                    ? `Resend OTP in ${otpCooldownSeconds}s`
                    : "Resend OTP"}
                {isRequestingOtp ? (
                  <Loader2 className="size-4 animate-spin" strokeWidth={2.2} />
                ) : null}
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
              <Button
                type="button"
                variant="outline"
                onClick={handleBackToMobile}
                className="h-11 justify-center gap-2 px-5 text-[15px] font-normal"
              >
                <ArrowLeft className="size-4" strokeWidth={2.2} />
                Back
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-11 w-full min-w-0 justify-between gap-4 px-5 text-[15px] font-normal sm:px-6 sm:text-button"
              >
                {isVerifyingOtp ? "Verifying..." : "Verify OTP"}
                {isVerifyingOtp ? (
                  <Loader2 className="size-4 animate-spin" strokeWidth={2.2} />
                ) : (
                  <ButtonArrow className="brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
                )}
              </Button>
            </div>
          </form>
        )}

      </div>

      {isProfilePopupOpen ? (
        <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-secondary/50 px-4 py-6 backdrop-blur-sm sm:items-center">
          <form
            className="my-auto w-full max-w-[430px] rounded-[10px] border border-white/80 bg-white p-5 shadow-[0_28px_80px_rgba(0,0,0,0.22)] sm:p-6"
            onSubmit={handleCompleteProfile}
          >
            <div className="text-center">
              <h3 className="font-heading text-[24px] font-bold leading-none text-secondary">
                Complete Your Profile
              </h3>
              <p className="mt-2 font-sans text-[13px] leading-[1.45] text-secondary/65">
                {profileMode === "google"
                  ? "Your Google account is verified. Add your phone number to continue."
                  : "Your mobile number is verified. Add your details to continue."}
              </p>
            </div>

            {profileErrorMessage ? (
              <div className="mt-5 rounded-[7px] border border-[#f1c4bb] bg-[#fff4f1] px-4 py-3 font-sans text-[12px] font-semibold leading-[1.45] text-[#b33620]">
                {profileErrorMessage}
              </div>
            ) : null}

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="font-sans text-[13px] font-bold text-secondary">
                  First Name
                </span>
                <span className="mt-2 flex h-12 items-center gap-3 rounded-[7px] border border-border bg-white px-4 text-secondary/48 transition-colors focus-within:border-primary">
                  <UserRound className="size-4" strokeWidth={1.8} />
                  <input
                    type="text"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    placeholder="First name"
                    className="h-full min-w-0 flex-1 bg-transparent font-sans text-[13px] text-secondary outline-none placeholder:text-secondary/42"
                    required
                  />
                </span>
              </label>

              <label className="block">
                <span className="font-sans text-[13px] font-bold text-secondary">
                  Last Name
                </span>
                <span className="mt-2 flex h-12 items-center gap-3 rounded-[7px] border border-border bg-white px-4 text-secondary/48 transition-colors focus-within:border-primary">
                  <UserRound className="size-4" strokeWidth={1.8} />
                  <input
                    type="text"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    placeholder="Last name"
                    className="h-full min-w-0 flex-1 bg-transparent font-sans text-[13px] text-secondary outline-none placeholder:text-secondary/42"
                    required
                  />
                </span>
              </label>

              {profileMode === "google" ? (
                <label className="block sm:col-span-2">
                  <span className="font-sans text-[13px] font-bold text-secondary">
                    Phone Number
                  </span>
                  <span className="mt-2 flex h-12 items-center gap-4 rounded-[7px] border border-border bg-white px-4 text-secondary/48 transition-colors focus-within:border-primary">
                    <Phone className="size-4" strokeWidth={1.8} />
                    <span className="border-r border-border pr-3 font-sans text-[13px] font-semibold text-secondary">
                      +91
                    </span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      value={mobileNumber}
                      onChange={(event) =>
                        setMobileNumber(getDisplayMobileNumber(event.target.value))
                      }
                      maxLength={10}
                      placeholder="Enter mobile number"
                      className="h-full min-w-0 flex-1 bg-transparent font-sans text-[13px] text-secondary outline-none placeholder:text-secondary/42"
                      required
                    />
                  </span>
                </label>
              ) : (
                <label className="block sm:col-span-2">
                  <span className="font-sans text-[13px] font-bold text-secondary">
                    Email
                  </span>
                  <span className="mt-2 flex h-12 items-center gap-3 rounded-[7px] border border-border bg-white px-4 text-secondary/48 transition-colors focus-within:border-primary">
                    <Mail className="size-4" strokeWidth={1.8} />
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="Email address"
                      className="h-full min-w-0 flex-1 bg-transparent font-sans text-[13px] text-secondary outline-none placeholder:text-secondary/42"
                      required
                    />
                  </span>
                </label>
              )}
            </div>

            <Button
              type="submit"
              disabled={isCompletingProfile}
              className="mt-6 h-11 w-full min-w-0 justify-between gap-4 px-5 text-[15px] font-normal sm:px-6 sm:text-button"
            >
              Complete Profile
              {isCompletingProfile ? (
                <Loader2 className="size-4 animate-spin" strokeWidth={2.2} />
              ) : (
                <ButtonArrow className="brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleBackToMobile}
              className="mt-4 h-11 w-full justify-center gap-2 px-5 text-[14px] font-normal"
            >
              <ArrowLeft className="size-4" strokeWidth={2} />
              {profileMode === "google" ? "Back to login" : "Use a different number"}
            </Button>
          </form>
        </div>
      ) : null}
    </>
  );
}
