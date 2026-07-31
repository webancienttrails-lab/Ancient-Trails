"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Headphones,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  hasValidAdminSession,
  isAdminRole,
  loginAdmin,
  saveAdminSession,
} from "@/lib/admin-auth";

const authenticatedHomePath = "/";
const rememberedEmailKey = "ancient_trails_admin_remembered_email";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function sanitizeRedirectPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return authenticatedHomePath;
  }

  if (value === "/login" || value.startsWith("/login?")) {
    return authenticatedHomePath;
  }

  return value;
}

function getInitialRedirectPath(): string {
  const params = new URLSearchParams(window.location.search);

  return sanitizeRedirectPath(params.get("redirect"));
}

export function AdminLoginCard() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return window.localStorage.getItem(rememberedEmailKey) || "";
  });
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return Boolean(window.localStorage.getItem(rememberedEmailKey));
  });
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    if (hasValidAdminSession()) {
      router.replace(getInitialRedirectPath());
    }

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const response = await loginAdmin({
        email: normalizedEmail,
        password,
      });
      const isAdmin = response.data.user.roles.some(isAdminRole);
      const isActive = response.data.user.status === "active";

      if (!isAdmin || !isActive) {
        throw new Error("This account does not have admin access.");
      }

      if (rememberMe) {
        window.localStorage.setItem(rememberedEmailKey, normalizedEmail);
      } else {
        window.localStorage.removeItem(rememberedEmailKey);
      }

      saveAdminSession(response.data);
      toast.success("Login successful", response.message);
      router.push(getInitialRedirectPath());
    } catch (error) {
      const message = getErrorMessage(error);

      setErrorMessage(message);
      toast.error("Admin login failed", message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-[350px] rounded-[12px] border border-white/85 bg-white/92 px-4 py-4 shadow-[0_22px_48px_rgba(92,62,38,0.22)] backdrop-blur-xl sm:px-6 sm:py-6">
      <div className="text-center">
        <Image
          src="/brand/header-logo.png"
          alt="Ancient Trails"
          width={156}
          height={52}
          priority
          className="mx-auto mb-2 h-auto w-[120px] sm:w-[148px] lg:hidden"
        />

        <h1 className="mt-1 font-heading text-[23px] font-bold leading-none tracking-normal text-[#4a3328] sm:mt-2 sm:text-[27px]">
          Admin Login
        </h1>
        <p className="mx-auto mt-1.5 max-w-[240px] text-[11px] font-medium leading-[1.4] text-[#6f5b50] sm:mt-2 sm:text-[13px] sm:leading-[1.45]">
          Sign in to access the Ancient Trails dashboard.
        </p>
      </div>

      <div className="mt-3 flex items-start gap-3 rounded-[7px] border border-[#f0d7bc] bg-[#fff7ed] px-3 py-2 sm:mt-4 sm:px-3.5 sm:py-2.5">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#c96a23]" strokeWidth={1.9} />
        <p className="text-[11px] font-medium leading-[1.42] text-[#5e493f] sm:text-[12px]">
          Admin access is limited to authorized super-admin accounts only.
        </p>
      </div>

      {errorMessage ? (
        <div className="mt-3 rounded-[7px] border border-red-200 bg-red-50 px-3.5 py-2.5 text-[11px] font-semibold leading-5 text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <form className="mt-3 space-y-2.5 sm:mt-4 sm:space-y-3" onSubmit={handleSubmit}>
        <label className="block">
          <span className="text-[12px] font-bold text-[#4e3b32]">
            Email Address
          </span>
          <span className="mt-1.5 flex h-10 items-center gap-3 rounded-[7px] border border-[#ead8c9] bg-white px-3.5 text-[#9b877a] shadow-[0_5px_14px_rgba(78,59,50,0.035)] transition-colors focus-within:border-[#c96a23] focus-within:ring-3 focus-within:ring-[#c96a23]/12 sm:h-11">
            <Mail className="size-4" strokeWidth={1.8} />
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your email"
              className="h-full min-w-0 flex-1 bg-transparent text-[13px] font-medium text-[#4a3328] outline-none placeholder:text-[#a6958b]"
              required
            />
          </span>
        </label>

        <label className="block">
          <span className="text-[12px] font-bold text-[#4e3b32]">
            Password
          </span>
          <span className="mt-1.5 flex h-10 items-center gap-3 rounded-[7px] border border-[#ead8c9] bg-white px-3.5 text-[#9b877a] shadow-[0_5px_14px_rgba(78,59,50,0.035)] transition-colors focus-within:border-[#c96a23] focus-within:ring-3 focus-within:ring-[#c96a23]/12 sm:h-11">
            <LockKeyhole className="size-4" strokeWidth={1.8} />
            <input
              type={isPasswordVisible ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              className="h-full min-w-0 flex-1 bg-transparent text-[13px] font-medium text-[#4a3328] outline-none placeholder:text-[#a6958b]"
              required
            />
            <button
              type="button"
              onClick={() => setIsPasswordVisible((value) => !value)}
              className="grid size-7 shrink-0 place-items-center rounded-md text-[#8e796d] transition-colors hover:bg-[#fff7ed] hover:text-[#c96a23]"
              aria-label={isPasswordVisible ? "Hide password" : "Show password"}
            >
              {isPasswordVisible ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </span>
        </label>

        <div className="flex items-center justify-between gap-3 text-[11px] sm:text-[12px]">
          <label className="flex min-w-0 items-center gap-2 text-[#6f5b50]">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="size-4 rounded border-[#dfc8b5] text-[#c96a23] accent-[#c96a23]"
            />
            <span className="truncate">Remember me</span>
          </label>

          <button
            type="button"
            onClick={() =>
              toast.info(
                "Forgot password",
                "Please contact support to reset an admin password."
              )
            }
            className="shrink-0 font-medium text-[#b9551f] transition-colors hover:text-[#8f3e13]"
          >
            Forgot password?
          </button>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-10 w-full justify-center rounded-[7px] border-[#c55f20] bg-[#c95f1e] px-4 text-[13px] font-bold text-white shadow-[0_12px_24px_rgba(188,83,25,0.22)] hover:bg-white hover:text-[#c95f1e] sm:h-11 sm:text-[14px]"
        >
          <span className="flex-1 text-center">
            {isSubmitting ? "Signing in..." : "Login"}
          </span>
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowRight className="size-4" />
          )}
        </Button>
      </form>

      <div className="mt-3 flex items-center justify-center gap-2 text-[#c7783d] sm:mt-4">
        <span className="h-px flex-1 bg-[#ead8c9]" />
        <span className="size-1.5 rotate-45 border border-[#c7783d]" />
        <span className="h-px flex-1 bg-[#ead8c9]" />
      </div>

      <div className="mt-2.5 flex items-center justify-center gap-2 text-[11px] text-[#7a6458] sm:mt-3 sm:text-[12px]">
        <Headphones className="size-4" />
        <span>Need help?</span>
        <button
          type="button"
          onClick={() =>
            toast.info("Contact support", "Admin support can help with access.")
          }
          className="font-semibold text-[#b9551f] transition-colors hover:text-[#8f3e13]"
        >
          Contact support
        </button>
      </div>
    </div>
  );
}
