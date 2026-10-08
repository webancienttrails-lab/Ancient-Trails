"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Mail, Phone, UserRound, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  getTravellerSession,
  isTravellerProfileComplete,
  listenForTravellerSessionChanges,
  saveTravellerSession,
  travellerProfileCompletionPath,
  updateTravellerProfile,
  type TravellerUser,
} from "@/lib/auth";

type CompletionForm = {
  firstName: string;
  lastName: string;
  email: string;
  countryCode: string;
  mobileNumber: string;
};

const emptyForm: CompletionForm = {
  firstName: "",
  lastName: "",
  email: "",
  countryCode: "+91",
  mobileNumber: "",
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function hasValidEmailShape(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim().toLowerCase());
}

function getDigits(value: string) {
  return value.replace(/\D/g, "");
}

function getCompletionForm(user: TravellerUser | null): CompletionForm {
  if (!user) {
    return emptyForm;
  }

  return {
    ...emptyForm,
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    email: user.email || "",
    mobileNumber: "",
  };
}

function getProfileMobileNumber(user: TravellerUser, form: CompletionForm) {
  if (user.mobileNumber?.trim()) {
    return user.mobileNumber.trim();
  }

  const countryCode = getDigits(form.countryCode);
  const localNumber = getDigits(form.mobileNumber);

  if (!countryCode || !localNumber) {
    return "";
  }

  return `${countryCode}${localNumber}`;
}

function validateCompletionForm(user: TravellerUser, form: CompletionForm) {
  if (!form.firstName.trim() || !form.lastName.trim()) {
    return "Please enter your first and last name.";
  }

  if (!user.email && !hasValidEmailShape(form.email)) {
    return "Please enter a valid email address.";
  }

  const mobileNumber = getProfileMobileNumber(user, form);

  if (!mobileNumber || !/^\d{10,15}$/.test(mobileNumber)) {
    return "Please enter a phone number with country code, 10 to 15 digits total.";
  }

  return "";
}

export function ProfileCompletionPrompt() {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [travellerUser, setTravellerUser] = useState<TravellerUser | null>(null);
  const [form, setForm] = useState<CompletionForm>(emptyForm);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const isProfileComplete = useMemo(
    () => isTravellerProfileComplete(travellerUser),
    [travellerUser]
  );
  const needsEmail = Boolean(travellerUser && !travellerUser.email?.trim());
  const needsMobileNumber = Boolean(
    travellerUser && !travellerUser.mobileNumber?.trim()
  );

  useEffect(() => {
    const syncTraveller = () => {
      const user = getTravellerSession()?.user ?? null;

      setTravellerUser(user);
      setForm(getCompletionForm(user));
    };

    syncTraveller();

    return listenForTravellerSessionChanges(syncTraveller);
  }, []);

  useEffect(() => {
    if (
      !travellerUser ||
      isProfileComplete ||
      pathname === "/login" ||
      pathname === travellerProfileCompletionPath
    ) {
      setIsOpen(false);
      return;
    }

    setErrorMessage("");
    setIsOpen(true);
  }, [isProfileComplete, pathname, travellerUser]);

  function updateForm<TKey extends keyof CompletionForm>(
    key: TKey,
    value: CompletionForm[TKey]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!travellerUser) {
      return;
    }

    const validationMessage = validateCompletionForm(travellerUser, form);

    if (validationMessage) {
      setErrorMessage(validationMessage);
      toast.error("Profile details required", validationMessage);
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      const response = await updateTravellerProfile({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: (travellerUser.email || form.email).trim().toLowerCase(),
        mobileNumber: getProfileMobileNumber(travellerUser, form),
        gender: travellerUser.gender || "",
        nationality: travellerUser.nationality || "",
        dateOfBirth: travellerUser.dateOfBirth || "",
      });

      saveTravellerSession(response.data);
      setTravellerUser(response.data.user);
      setIsOpen(false);
      toast.success("Profile completed", response.message);
    } catch (error) {
      const message = getErrorMessage(error);

      setErrorMessage(message);
      toast.error("Profile save failed", message);
    } finally {
      setIsSaving(false);
    }
  }

  if (!isOpen || !travellerUser) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[2147483647] flex items-start justify-center overflow-y-auto bg-secondary/50 px-4 py-6 backdrop-blur-sm sm:items-center">
      <form
        className="my-auto w-full max-w-[460px] rounded-[10px] border border-white/80 bg-white p-5 text-secondary shadow-[0_28px_80px_rgba(0,0,0,0.22)] sm:p-6"
        onSubmit={handleSubmit}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-heading text-[24px] font-bold leading-none">
              Complete Your Profile
            </h2>
            <p className="mt-2 font-sans text-[13px] font-medium leading-[1.45] text-secondary/65">
              Add these details once so bookings and traveller forms are easier.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close profile completion"
            onClick={() => setIsOpen(false)}
            className="grid size-9 shrink-0 place-items-center rounded-full border border-border text-secondary/65 transition-colors hover:border-primary hover:bg-primary hover:text-white"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </div>

        {errorMessage ? (
          <div className="mt-5 rounded-[7px] border border-[#f1c4bb] bg-[#fff4f1] px-4 py-3 font-sans text-[12px] font-semibold leading-[1.45] text-[#b33620]">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="font-sans text-[13px] font-bold">First Name</span>
            <span className="mt-2 flex h-12 items-center gap-3 rounded-[7px] border border-border bg-white px-4 text-secondary/48 transition-colors focus-within:border-primary">
              <UserRound className="size-4" strokeWidth={1.8} />
              <input
                type="text"
                autoComplete="given-name"
                value={form.firstName}
                onChange={(event) => updateForm("firstName", event.target.value)}
                placeholder="First name"
                className="h-full min-w-0 flex-1 bg-transparent font-sans text-[13px] font-medium text-secondary outline-none placeholder:text-secondary/42"
                required
              />
            </span>
          </label>

          <label className="block">
            <span className="font-sans text-[13px] font-bold">Last Name</span>
            <span className="mt-2 flex h-12 items-center gap-3 rounded-[7px] border border-border bg-white px-4 text-secondary/48 transition-colors focus-within:border-primary">
              <UserRound className="size-4" strokeWidth={1.8} />
              <input
                type="text"
                autoComplete="family-name"
                value={form.lastName}
                onChange={(event) => updateForm("lastName", event.target.value)}
                placeholder="Last name"
                className="h-full min-w-0 flex-1 bg-transparent font-sans text-[13px] font-medium text-secondary outline-none placeholder:text-secondary/42"
                required
              />
            </span>
          </label>

          {needsEmail ? (
            <label className="block sm:col-span-2">
              <span className="font-sans text-[13px] font-bold">Email</span>
              <span className="mt-2 flex h-12 items-center gap-3 rounded-[7px] border border-border bg-white px-4 text-secondary/48 transition-colors focus-within:border-primary">
                <Mail className="size-4" strokeWidth={1.8} />
                <input
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(event) => updateForm("email", event.target.value)}
                  placeholder="Email address"
                  className="h-full min-w-0 flex-1 bg-transparent font-sans text-[13px] font-medium text-secondary outline-none placeholder:text-secondary/42"
                  required
                />
              </span>
            </label>
          ) : null}

          {needsMobileNumber ? (
            <label className="block sm:col-span-2">
              <span className="font-sans text-[13px] font-bold">Phone Number</span>
              <span className="mt-2 grid h-12 grid-cols-[88px_minmax(0,1fr)] items-center rounded-[7px] border border-border bg-white text-secondary/48 transition-colors focus-within:border-primary">
                <span className="flex h-full items-center gap-2 border-r border-border px-3">
                  <Phone className="size-4" strokeWidth={1.8} />
                  <input
                    type="text"
                    inputMode="tel"
                    value={form.countryCode}
                    onChange={(event) =>
                      updateForm(
                        "countryCode",
                        `+${getDigits(event.target.value).slice(0, 4)}`
                      )
                    }
                    aria-label="Phone country code"
                    className="h-full w-11 bg-transparent font-sans text-[13px] font-semibold text-secondary outline-none"
                  />
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={form.mobileNumber}
                  onChange={(event) =>
                    updateForm(
                      "mobileNumber",
                      getDigits(event.target.value).slice(0, 14)
                    )
                  }
                  placeholder="Phone number"
                  className="h-full min-w-0 bg-transparent px-4 font-sans text-[13px] font-medium text-secondary outline-none placeholder:text-secondary/42"
                  required
                />
              </span>
            </label>
          ) : null}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
          <Button
            type="submit"
            disabled={isSaving}
            className="h-11 justify-center px-6 text-[14px] font-normal"
          >
            {isSaving ? "Saving..." : "Save Profile"}
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={2.2} />
            ) : null}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setIsOpen(false);
              router.push(travellerProfileCompletionPath);
            }}
            className="h-11 justify-center px-5 text-[14px] font-normal"
          >
            My Account
          </Button>
        </div>
      </form>
    </div>
  );
}
