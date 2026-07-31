"use client";

import Image from "next/image";
import {
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronRight,
  FileText,
  IdCard,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import {
  Calendar,
  formatCalendarDateLabel,
} from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { DashboardTopBar } from "@/components/user-dashboard/dashboard-top-bar";
import { UserAvatar, UserSidebar } from "@/components/user-dashboard/user-sidebar";
import {
  getTravellerSession,
  requestTravellerProfileMobileChangeOtp,
  saveTravellerSession,
  updateTravellerProfile,
  type TravellerUser,
} from "@/lib/auth";
import {
  getStoredProfilePhoto,
  removeStoredProfilePhoto,
  saveStoredProfilePhoto,
} from "@/lib/profile-photo";

const kycDocuments = [
  {
    title: "Aadhaar Card",
    note: "If Aadhaar is not available, please upload any other document from below",
  },
  { title: "Passport" },
  { title: "PAN Card" },
  { title: "Voter Card" },
  { title: "Birth Certificate" },
  { title: "Driver License" },
];

type ProfileGender = "" | "Male" | "Female";
type NationalitySelection = "" | "Indian" | "Other";

type ProfileFormState = {
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber: string;
  gender: ProfileGender;
  nationality: NationalitySelection;
  otherNationality: string;
  dateOfBirth: string;
};

const emptyProfileForm: ProfileFormState = {
  firstName: "",
  lastName: "",
  email: "",
  mobileNumber: "",
  gender: "",
  nationality: "",
  otherNationality: "",
  dateOfBirth: "",
};

function getTravellerInitials(user: TravellerUser | null) {
  if (!user) {
    return "TR";
  }

  const parts = [user.firstName, user.lastName]
    .map((part) => part?.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`;
  }

  return (parts[0] || user.email || "TR").slice(0, 2);
}

function getProfileGender(gender?: string): ProfileGender {
  return gender === "Male" || gender === "Female" ? gender : "";
}

function getProfileNationality(nationality?: string) {
  const trimmedNationality = nationality?.trim() || "";

  if (!trimmedNationality) {
    return {
      nationality: "" as NationalitySelection,
      otherNationality: "",
    };
  }

  if (trimmedNationality === "Indian") {
    return {
      nationality: "Indian" as NationalitySelection,
      otherNationality: "",
    };
  }

  return {
    nationality: "Other" as NationalitySelection,
    otherNationality: trimmedNationality === "Other" ? "" : trimmedNationality,
  };
}

function getProfileFormFromUser(user: TravellerUser | null): ProfileFormState {
  if (!user) {
    return emptyProfileForm;
  }

  const nationality = getProfileNationality(user.nationality);

  return {
    ...emptyProfileForm,
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    email: user.email || "",
    mobileNumber: getDisplayMobileNumber(user.mobileNumber),
    gender: getProfileGender(user.gender),
    ...nationality,
    dateOfBirth: user.dateOfBirth || "",
  };
}

function getNationalityValue(profileForm: ProfileFormState) {
  return profileForm.nationality === "Other"
    ? profileForm.otherNationality.trim()
    : profileForm.nationality;
}

function getDisplayMobileNumber(value?: string) {
  let digits = (value || "").replace(/\D/g, "");

  if (digits.length > 10 && digits.startsWith("91")) {
    digits = digits.slice(2);
  }

  if (digits.length > 10 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  return digits.slice(0, 10);
}

function normalizeMobileDraft(value: string) {
  const digits = getDisplayMobileNumber(value);

  return digits.length === 10 ? `91${digits}` : digits;
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

function getEmailWarningMessage(email: string) {
  const trimmedEmail = email.trim().toLowerCase();
  const [localPart] = trimmedEmail.split("@");

  if (!trimmedEmail) {
    return "Email address is required.";
  }

  if (!hasValidEmailShape(trimmedEmail)) {
    return localPart && localPart.length < 4
      ? "Please enter your complete email address."
      : "Please enter a valid email address.";
  }

  return "";
}

function getMobileWarningMessage(mobileNumber: string) {
  const digits = getDisplayMobileNumber(mobileNumber);

  if (!digits) {
    return "Phone number is required.";
  }

  if (digits.length !== 10) {
    return "Phone number must be 10 digits.";
  }

  return "";
}

function getComparableProfileForm(profileForm: ProfileFormState) {
  return {
    firstName: profileForm.firstName.trim(),
    lastName: profileForm.lastName.trim(),
    email: profileForm.email.trim().toLowerCase(),
    mobileNumber: normalizeMobileDraft(profileForm.mobileNumber),
    gender: profileForm.gender,
    nationality: getNationalityValue(profileForm).trim(),
    dateOfBirth: profileForm.dateOfBirth.trim(),
  };
}

function areProfileFormsEqual(
  currentForm: ProfileFormState,
  savedForm: ProfileFormState
) {
  const current = getComparableProfileForm(currentForm);
  const saved = getComparableProfileForm(savedForm);

  return Object.keys(current).every((key) => {
    const profileKey = key as keyof typeof current;

    return current[profileKey] === saved[profileKey];
  });
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="font-sans text-[12px] font-medium text-secondary/70">
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  type = "text",
  icon,
  placeholder,
  autoComplete,
}: {
  value: string;
  onChange: (value: string) => void;
  type?: string;
  icon?: React.ReactNode;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div className="relative mt-2">
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="h-11 w-full rounded-[6px] border border-border bg-white px-4 font-sans text-[13px] font-medium text-secondary outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15"
      />
      {icon ? (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary/55">
          {icon}
        </span>
      ) : null}
    </div>
  );
}

function DocumentRow({
  document,
  highlighted,
}: {
  document: (typeof kycDocuments)[number];
  highlighted?: boolean;
}) {
  return (
    <button
      type="button"
      className={`grid w-full grid-cols-[32px_minmax(0,1fr)_18px] items-center gap-3 border-b border-border px-2 py-4 text-left transition-colors last:border-b-0 hover:bg-primary/5 sm:grid-cols-[36px_minmax(0,1fr)_auto_18px] ${
        highlighted ? "bg-primary/5" : ""
      }`}
    >
      <span className="grid size-8 place-items-center rounded-full bg-primary/10 text-primary">
        <FileText className="size-4" strokeWidth={1.8} />
      </span>
      <span className="min-w-0">
        <span className="block font-heading text-[15px] font-bold leading-none text-secondary">
          {document.title}
        </span>
        {document.note ? (
          <span className="mt-1 block truncate font-sans text-[11px] text-primary/80">
            {document.note}
          </span>
        ) : null}
      </span>
      <span className="col-start-2 w-fit rounded-full bg-[#fff4e8] px-3 py-1 font-sans text-[10px] font-bold text-primary sm:col-start-auto">
        Not Uploaded
      </span>
      <ChevronRight
        className="col-start-3 row-start-1 size-4 text-secondary/50 sm:col-start-auto sm:row-start-auto"
        strokeWidth={1.9}
      />
    </button>
  );
}

export function AccountPageContent() {
  const toast = useToast();
  const [travellerUser, setTravellerUser] = useState<TravellerUser | null>(null);
  const [profileForm, setProfileForm] =
    useState<ProfileFormState>(emptyProfileForm);
  const [profilePhoto, setProfilePhoto] = useState("");
  const [photoFileName, setPhotoFileName] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isMobileOtpOpen, setIsMobileOtpOpen] = useState(false);
  const [isRequestingMobileOtp, setIsRequestingMobileOtp] = useState(false);
  const [isVerifyingMobileOtp, setIsVerifyingMobileOtp] = useState(false);
  const [mobileOtp, setMobileOtp] = useState("");
  const [mobileOtpTarget, setMobileOtpTarget] = useState("");
  const [mobileOtpCooldownSeconds, setMobileOtpCooldownSeconds] = useState(0);
  const [otherDocumentType, setOtherDocumentType] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mobileOtpAutoVerifyTimeoutRef = useRef<number | null>(null);

  const savedProfileForm = useMemo(
    () => getProfileFormFromUser(travellerUser),
    [travellerUser]
  );
  const initials = useMemo(
    () => getTravellerInitials(travellerUser),
    [travellerUser]
  );
  const isProfileDirty = useMemo(
    () => !areProfileFormsEqual(profileForm, savedProfileForm),
    [profileForm, savedProfileForm]
  );
  const emailWarningMessage = useMemo(
    () => getEmailWarningMessage(profileForm.email),
    [profileForm.email]
  );
  const mobileWarningMessage = useMemo(
    () => getMobileWarningMessage(profileForm.mobileNumber),
    [profileForm.mobileNumber]
  );
  const isEmailChanged =
    getComparableProfileForm(profileForm).email !==
    getComparableProfileForm(savedProfileForm).email;
  const isMobileNumberChanged =
    getComparableProfileForm(profileForm).mobileNumber !==
    getComparableProfileForm(savedProfileForm).mobileNumber;

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const session = getTravellerSession();
      const user = session?.user ?? null;

      setTravellerUser(user);
      setProfileForm(getProfileFormFromUser(user));

      if (user) {
        setProfilePhoto(getStoredProfilePhoto(user.id));
      } else {
        setProfilePhoto("");
      }
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (mobileOtpAutoVerifyTimeoutRef.current) {
        window.clearTimeout(mobileOtpAutoVerifyTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (mobileOtpCooldownSeconds <= 0) {
      return;
    }

    const timerId = window.setInterval(() => {
      setMobileOtpCooldownSeconds((seconds) => Math.max(seconds - 1, 0));
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [mobileOtpCooldownSeconds]);

  const updateProfileForm = <TKey extends keyof ProfileFormState>(
    key: TKey,
    value: ProfileFormState[TKey]
  ) => {
    setProfileForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updateNationality = (value: string | null) => {
    const nationality =
      value === "Indian" || value === "Other" ? value : "";

    setProfileForm((current) => ({
      ...current,
      nationality,
      otherNationality: nationality === "Other" ? current.otherNationality : "",
    }));
  };

  const updateMobileNumber = (value: string) => {
    const mobileNumber = getDisplayMobileNumber(value);

    setProfileForm((current) => ({
      ...current,
      mobileNumber,
    }));

    if (mobileOtpTarget && normalizeMobileDraft(mobileNumber) !== mobileOtpTarget) {
      setIsMobileOtpOpen(false);
      setMobileOtp("");
      setMobileOtpTarget("");
      setMobileOtpCooldownSeconds(0);
    }
  };

  const resetProfileForm = () => {
    setProfileForm(getProfileFormFromUser(travellerUser));
    setStatusMessage("");
    setErrorMessage("");
    setIsMobileOtpOpen(false);
    setMobileOtp("");
    setMobileOtpTarget("");
    setMobileOtpCooldownSeconds(0);

    toast.info("Changes reset", "Your account form has been restored.");
  };

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      const message = "Please choose an image file.";

      setErrorMessage(message);
      toast.error("Photo upload failed", message);
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      const message = "Profile photo must be smaller than 2 MB.";

      setErrorMessage(message);
      toast.error("Photo upload failed", message);
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const photoData = typeof reader.result === "string" ? reader.result : "";

      setProfilePhoto(photoData);
      setPhotoFileName(file.name);
      setErrorMessage("");
      toast.success("Photo updated", "Your profile photo is now visible in the header.");

      if (travellerUser && photoData) {
        saveStoredProfilePhoto(travellerUser.id, photoData);
      }
    };

    reader.readAsDataURL(file);
  };

  const removeProfilePhoto = () => {
    setProfilePhoto("");
    setPhotoFileName("");

    if (travellerUser) {
      removeStoredProfilePhoto(travellerUser.id);
    }

    toast.info("Photo removed", "Your profile avatar has been reset.");
  };

  const handleOtherDocumentUpload = () => {
    if (!otherDocumentType) {
      toast.warning("Select document type", "Choose a document type before uploading.");
      return;
    }

    toast.info("Upload selected", `${otherDocumentType} document upload is ready.`);
  };

  const validateProfileDraft = () => {
    const nationalityValue = getNationalityValue(profileForm);
    const emailMessage = getEmailWarningMessage(profileForm.email);

    if (emailMessage) {
      setErrorMessage(emailMessage);
      toast.error("Email required", emailMessage);
      return null;
    }

    const mobileMessage = getMobileWarningMessage(profileForm.mobileNumber);

    if (mobileMessage) {
      setErrorMessage(mobileMessage);
      toast.error("Phone number required", mobileMessage);
      return null;
    }

    if (profileForm.nationality === "Other" && !nationalityValue) {
      const message = "Please enter your country name.";

      setErrorMessage(message);
      toast.error("Country name required", message);
      return null;
    }

    return nationalityValue;
  };

  const saveProfileChanges = async (mobileNumberOtp?: string) => {
    const nationalityValue = validateProfileDraft();

    if (nationalityValue === null) {
      return;
    }

    const isOtpSave = Boolean(mobileNumberOtp);

    if (isOtpSave) {
      setIsVerifyingMobileOtp(true);
    } else {
      setIsSaving(true);
    }

    try {
      const response = await updateTravellerProfile({
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        email: profileForm.email,
        mobileNumber: profileForm.mobileNumber,
        mobileNumberOtp,
        gender: profileForm.gender,
        nationality: nationalityValue,
        dateOfBirth: profileForm.dateOfBirth,
      });

      saveTravellerSession(response.data);
      setTravellerUser(response.data.user);
      setProfileForm(getProfileFormFromUser(response.data.user));
      setIsMobileOtpOpen(false);
      setMobileOtp("");
      setMobileOtpTarget("");
      setMobileOtpCooldownSeconds(0);
      setStatusMessage(response.message);
      toast.success("Profile saved", response.message);
    } catch (error) {
      const message = getErrorMessage(error);

      setErrorMessage(message);
      toast.error("Profile save failed", message);
    } finally {
      if (isOtpSave) {
        setIsVerifyingMobileOtp(false);
      } else {
        setIsSaving(false);
      }
    }
  };

  const requestMobileChangeOtpFor = async (mobileNumber: string) => {
    setStatusMessage("");
    setErrorMessage("");
    setIsRequestingMobileOtp(true);

    try {
      const response = await requestTravellerProfileMobileChangeOtp(
        mobileNumber
      );

      setMobileOtp("");
      setMobileOtpTarget(response.data.mobileNumber);
      setIsMobileOtpOpen(true);
      setMobileOtpCooldownSeconds(60);
      toast.success("OTP sent", response.message);
    } catch (error) {
      const message = getErrorMessage(error);

      setErrorMessage(message);
      toast.error("Could not send OTP", message);
    } finally {
      setIsRequestingMobileOtp(false);
    }
  };

  const requestMobileChangeOtp = async () => {
    await requestMobileChangeOtpFor(profileForm.mobileNumber);
  };

  const verifyMobileOtpAndSave = async (otpValue: string) => {
    const trimmedOtp = otpValue.trim();

    setStatusMessage("");
    setErrorMessage("");

    if (!/^\d{4,9}$/.test(trimmedOtp)) {
      const message = "OTP must be 4 to 9 digits.";

      setErrorMessage(message);
      toast.error("Invalid OTP", message);
      return;
    }

    if (mobileOtpTarget !== normalizeMobileDraft(profileForm.mobileNumber)) {
      const message = "Mobile number changed. Please request a new OTP.";

      setErrorMessage(message);
      toast.error("Request OTP again", message);
      setIsMobileOtpOpen(false);
      setMobileOtp("");
      setMobileOtpTarget("");
      return;
    }

    await saveProfileChanges(trimmedOtp);
  };

  const handleMobileOtpChange = (value: string) => {
    const otpValue = value.replace(/\D/g, "").slice(0, 9);

    setMobileOtp(otpValue);

    if (mobileOtpAutoVerifyTimeoutRef.current) {
      window.clearTimeout(mobileOtpAutoVerifyTimeoutRef.current);
    }

    if (
      !isMobileOtpOpen ||
      isVerifyingMobileOtp ||
      !/^\d{4,9}$/.test(otpValue)
    ) {
      return;
    }

    mobileOtpAutoVerifyTimeoutRef.current = window.setTimeout(() => {
      void verifyMobileOtpAndSave(otpValue);
    }, 650);
  };

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage("");
    setErrorMessage("");

    if (!isProfileDirty) {
      toast.info("No changes", "Edit your account details before saving.");
      return;
    }

    if (validateProfileDraft() === null) {
      return;
    }

    if (isMobileNumberChanged) {
      if (!isMobileOtpOpen) {
        await requestMobileChangeOtp();
        return;
      }

      await verifyMobileOtpAndSave(mobileOtp);
      return;
    }

    await saveProfileChanges();
  };

  return (
    <>
      <main className="min-h-screen overflow-x-hidden bg-[#fbf8f4] text-secondary lg:overflow-x-visible">
      <div className="grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        <UserSidebar activeLabel="My Account" />

        <section className="min-w-0">
          <DashboardTopBar />

          <div className="mx-auto w-full max-w-[1220px] px-3 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
            <section className="relative overflow-hidden pb-5 sm:pb-8">
              <Image
                src="/home assets/About_trails.webp"
                alt=""
                fill
                sizes="(min-width: 1024px) 560px, 100vw"
                priority
                className="pointer-events-none object-cover object-right-top opacity-[0.22] mix-blend-multiply"
              />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,#fbf8f4_0%,#fbf8f4_46%,rgba(251,248,244,0.78)_68%,rgba(251,248,244,0.58)_100%)]" />
              <div className="relative">
                <h1 className="font-heading text-[30px] font-bold leading-none text-secondary sm:text-[34px]">
                  My Account
                </h1>
                <p className="mt-3 font-sans text-[13px] font-medium text-secondary/70">
                  Manage your personal information and account details.
                </p>
              </div>
            </section>

            <section className="rounded-[8px] border border-border bg-white p-4 shadow-[0_14px_34px_rgba(50,50,50,0.035)] sm:p-6">
              <h2 className="border-l-2 border-primary pl-3 font-heading text-[17px] font-bold text-secondary">
                Personal Information
              </h2>

              <form
                className="mt-5 grid gap-5 sm:mt-6 sm:gap-8 xl:grid-cols-[minmax(0,680px)_280px]"
                onSubmit={handleSaveProfile}
              >
                <div className="space-y-5 sm:space-y-6">
                  {statusMessage ? (
                    <div className="flex items-start gap-3 rounded-[7px] border border-[#bfe5ca] bg-[#f0fbf3] px-4 py-3 font-sans text-[12px] font-semibold leading-[1.45] text-[#2f7d3b]">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
                      {statusMessage}
                    </div>
                  ) : null}

                  {errorMessage ? (
                    <div className="rounded-[7px] border border-[#f1c4bb] bg-[#fff4f1] px-4 py-3 font-sans text-[12px] font-semibold leading-[1.45] text-[#b33620]">
                      {errorMessage}
                    </div>
                  ) : null}

                  <div className="rounded-[8px] border border-border/80 bg-[#fffdfb] p-4 sm:p-5">
                    <h3 className="font-heading text-[15px] font-bold text-secondary">
                      Basic Details
                    </h3>
                    <div className="mt-4 grid gap-5 sm:grid-cols-2">
                      <div>
                        <FieldLabel>First Name*</FieldLabel>
                        <TextInput
                          value={profileForm.firstName}
                          onChange={(value) => updateProfileForm("firstName", value)}
                          placeholder="First name"
                          autoComplete="given-name"
                          icon={<UserRound className="size-4" strokeWidth={1.8} />}
                        />
                      </div>

                      <div>
                        <FieldLabel>Last Name*</FieldLabel>
                        <TextInput
                          value={profileForm.lastName}
                          onChange={(value) => updateProfileForm("lastName", value)}
                          placeholder="Last name"
                          autoComplete="family-name"
                          icon={<UserRound className="size-4" strokeWidth={1.8} />}
                        />
                      </div>

                      <div>
                        <FieldLabel>Email Address*</FieldLabel>
                        <TextInput
                          type="email"
                          value={profileForm.email}
                          onChange={(value) => updateProfileForm("email", value)}
                          placeholder="Email address"
                          autoComplete="email"
                          icon={<Mail className="size-4" strokeWidth={1.8} />}
                        />
                        {isEmailChanged && emailWarningMessage ? (
                          <p className="mt-2 font-sans text-[11px] font-semibold leading-[1.45] text-[#b33620]">
                            {emailWarningMessage}
                          </p>
                        ) : null}
                        {isEmailChanged && !emailWarningMessage ? (
                          <p className="mt-2 flex items-center gap-1.5 font-sans text-[11px] font-semibold leading-[1.45] text-[#2f8f46]">
                            <CheckCircle2 className="size-3.5" strokeWidth={2} />
                            Email looks valid and will be checked before saving.
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <FieldLabel>Phone Number*</FieldLabel>
                        <div className="mt-2 flex h-11 items-center gap-3 rounded-[6px] border border-border bg-white px-4 text-secondary/48 transition-colors focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15">
                          <Phone className="size-4" strokeWidth={1.8} />
                          <span className="border-r border-border pr-3 font-sans text-[13px] font-semibold text-secondary">
                            +91
                          </span>
                          <input
                            type="tel"
                            inputMode="numeric"
                            autoComplete="tel"
                            value={profileForm.mobileNumber}
                            onChange={(event) => updateMobileNumber(event.target.value)}
                            maxLength={10}
                            placeholder="Enter mobile number"
                            className="h-full min-w-0 flex-1 bg-transparent font-sans text-[13px] font-medium text-secondary outline-none placeholder:text-secondary/42"
                          />
                        </div>
                        {isMobileNumberChanged && mobileWarningMessage ? (
                          <p className="mt-2 font-sans text-[11px] font-semibold leading-[1.45] text-[#b33620]">
                            {mobileWarningMessage}
                          </p>
                        ) : null}
                      </div>

                      {isMobileNumberChanged ? (
                        <div className="rounded-[7px] border border-primary/20 bg-primary/5 p-4 sm:col-span-2 sm:p-5">
                          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                            <div className="min-w-0 flex-1">
                              <FieldLabel>
                                {isMobileOtpOpen
                                  ? "OTP for New Phone Number*"
                                  : "Phone Verification"}
                              </FieldLabel>
                              {isMobileOtpOpen ? (
                                <>
                                  <div className="mt-2 flex h-11 items-center gap-3 rounded-[6px] border border-border bg-white px-4 text-secondary/48 transition-colors focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15">
                                    <ShieldCheck className="size-4" strokeWidth={1.8} />
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      autoComplete="one-time-code"
                                      value={mobileOtp}
                                      onChange={(event) =>
                                        handleMobileOtpChange(event.target.value)
                                      }
                                      placeholder="Enter OTP"
                                      className="h-full min-w-0 flex-1 bg-transparent font-sans text-[13px] font-medium text-secondary outline-none placeholder:text-secondary/42"
                                    />
                                  </div>
                                </>
                              ) : (
                                <p className="mt-2 font-sans text-[12px] font-medium leading-[1.45] text-secondary/68">
                                  Verify this new number with OTP before saving.
                                </p>
                              )}
                            </div>

                            <Button
                              type="button"
                              variant="outline"
                              disabled={
                                isVerifyingMobileOtp ||
                                isRequestingMobileOtp ||
                                mobileOtpCooldownSeconds > 0 ||
                                Boolean(mobileWarningMessage) ||
                                (isEmailChanged && Boolean(emailWarningMessage))
                              }
                              onClick={requestMobileChangeOtp}
                              className="h-11 w-full justify-center px-5 text-[13px] font-normal sm:mt-[26px] sm:w-[190px]"
                            >
                              {isVerifyingMobileOtp
                                ? "Verifying..."
                                : isRequestingMobileOtp
                                  ? "Sending..."
                                  : isMobileOtpOpen && mobileOtpCooldownSeconds > 0
                                    ? `Resend OTP in ${mobileOtpCooldownSeconds}s`
                                    : isMobileOtpOpen
                                      ? "Resend OTP"
                                      : "Send OTP"}
                              {isRequestingMobileOtp || isVerifyingMobileOtp ? (
                                <Loader2 className="size-4 animate-spin" strokeWidth={2.2} />
                              ) : null}
                            </Button>

                            {isMobileOtpOpen ? (
                              <p className="font-sans text-[11px] font-medium leading-[1.45] text-secondary/62 sm:col-span-2">
                                Enter the OTP and your new number will save automatically.
                              </p>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-[8px] border border-border/80 bg-[#fffdfb] p-4 sm:p-5">
                    <h3 className="font-heading text-[15px] font-bold text-secondary">
                      Traveller Details
                    </h3>
                    <div className="mt-4 grid gap-5 sm:grid-cols-2">
                      <div>
                        <FieldLabel>Gender</FieldLabel>
                        <div className="mt-2 grid grid-cols-2 gap-3">
                          {(["Male", "Female"] as const).map((gender) => (
                            <Button
                              key={gender}
                              type="button"
                              variant="outline"
                              onClick={() => updateProfileForm("gender", gender)}
                              className={`h-11 px-5 text-[13px] font-medium ${
                                profileForm.gender === gender
                                  ? "border-primary text-primary"
                                  : "border-border text-secondary/70 hover:border-primary hover:text-white"
                              }`}
                            >
                              {gender}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <FieldLabel>Nationality*</FieldLabel>
                        <Select
                          value={profileForm.nationality || null}
                          onValueChange={updateNationality}
                        >
                          <SelectTrigger className="mt-2">
                            <SelectValue placeholder="Select nationality" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Indian">Indian</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {profileForm.nationality === "Other" ? (
                        <div>
                          <FieldLabel>Country Name*</FieldLabel>
                          <TextInput
                            value={profileForm.otherNationality}
                            onChange={(value) =>
                              updateProfileForm("otherNationality", value)
                            }
                            placeholder="Enter country name"
                            autoComplete="country-name"
                          />
                        </div>
                      ) : null}

                      <div>
                        <FieldLabel>Date of Birth*</FieldLabel>
                        <Popover
                          open={isDatePickerOpen}
                          onOpenChange={setIsDatePickerOpen}
                        >
                          <PopoverTrigger
                            type="button"
                            className="mt-2 flex h-11 w-full items-center justify-between gap-3 rounded-[6px] border border-border bg-white px-4 font-sans text-[13px] font-medium text-secondary outline-none transition-colors hover:border-primary/70 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15 data-[popup-open]:border-primary data-[popup-open]:ring-3 data-[popup-open]:ring-primary/15"
                          >
                            <span
                              className={
                                profileForm.dateOfBirth
                                  ? "truncate"
                                  : "truncate text-secondary/45"
                              }
                            >
                              {formatCalendarDateLabel(profileForm.dateOfBirth) ||
                                "Select date of birth"}
                            </span>
                            <CalendarDays className="size-4 shrink-0 text-secondary/55" strokeWidth={1.8} />
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-2">
                            <Calendar
                              value={profileForm.dateOfBirth}
                              onChange={(value) => {
                                updateProfileForm("dateOfBirth", value);
                                setIsDatePickerOpen(false);
                              }}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </div>

                  {isProfileDirty ? (
                    <div className="flex flex-wrap gap-3 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={resetProfileForm}
                        className="min-w-[110px] px-6 font-normal"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={
                          isSaving ||
                          isRequestingMobileOtp ||
                          isVerifyingMobileOtp ||
                          (isMobileNumberChanged && Boolean(mobileWarningMessage)) ||
                          (isEmailChanged && Boolean(emailWarningMessage))
                        }
                        className="min-w-[145px] px-6 font-normal"
                      >
                        {isVerifyingMobileOtp
                          ? "Verifying..."
                          : isSaving
                            ? "Saving..."
                            : isRequestingMobileOtp
                              ? "Sending OTP..."
                              : isMobileNumberChanged
                                ? isMobileOtpOpen
                                  ? "Verify & Save"
                                  : "Send OTP"
                                : "Save Changes"}
                        {isSaving || isRequestingMobileOtp || isVerifyingMobileOtp ? (
                          <Loader2 className="size-4 animate-spin" strokeWidth={2.2} />
                        ) : null}
                      </Button>
                    </div>
                  ) : null}
                </div>

                <aside className="rounded-[8px] border border-border bg-[#fffaf5] p-5">
                  <p className="font-heading text-[16px] font-bold text-secondary">
                    Profile Photo
                  </p>
                  <div className="mt-5 flex flex-col items-center text-center">
                    <div className="relative grid size-[124px] place-items-center rounded-full bg-primary/10">
                      <div className="grid size-[88px] place-items-center overflow-hidden rounded-full">
                        {profilePhoto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={profilePhoto}
                            alt="Profile preview"
                            className="size-full object-cover"
                          />
                        ) : (
                          <UserAvatar size="lg" initials={initials} />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute bottom-2 right-2 z-10 grid size-9 place-items-center rounded-full border-[3px] border-[#fffaf5] bg-primary text-white shadow-[0_8px_18px_rgba(50,50,50,0.16)] transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-primary/25"
                        aria-label="Upload profile photo"
                      >
                        <Camera className="size-4" strokeWidth={2.2} />
                      </button>
                    </div>

                    <p className="mt-3 max-w-[200px] font-sans text-[12px] leading-[1.4] text-secondary/65">
                      Choose a clear photo for your traveller profile.
                    </p>
                    {photoFileName ? (
                      <p className="mt-2 max-w-[210px] truncate font-sans text-[11px] font-medium text-secondary/60">
                        {photoFileName}
                      </p>
                    ) : null}

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoChange}
                    />

                    <div className="mt-5 grid w-full gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full justify-center gap-2 px-4 font-normal"
                      >
                        <Camera className="size-4" strokeWidth={1.8} />
                        Upload Photo
                      </Button>
                      {profilePhoto ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={removeProfilePhoto}
                          className="w-full justify-center gap-2 border-border px-4 font-normal text-secondary/70 hover:border-primary hover:text-white"
                        >
                          <Trash2 className="size-4" strokeWidth={1.8} />
                          Remove Photo
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </aside>
              </form>
            </section>

            <section className="mt-4 rounded-[8px] border border-border bg-white p-4 shadow-[0_14px_34px_rgba(50,50,50,0.035)] sm:mt-6 sm:p-6">
              <div className="flex items-start gap-3">
                <IdCard className="mt-0.5 size-5 text-primary" strokeWidth={1.8} />
                <div>
                  <h2 className="font-heading text-[17px] font-bold text-secondary">
                    KYC Documents
                  </h2>
                  <p className="mt-1 font-sans text-[12px] text-secondary/70">
                    Upload identity related documents.
                  </p>
                </div>
              </div>

              <div className="mt-5 overflow-hidden rounded-[7px] border border-border">
                {kycDocuments.map((document, index) => (
                  <DocumentRow
                    key={document.title}
                    document={document}
                    highlighted={index === 0}
                  />
                ))}
              </div>

              <div className="mt-8">
                <h3 className="font-heading text-[16px] font-bold text-secondary">
                  Other Documents
                </h3>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <div className="sm:w-[360px]">
                    <Select
                      value={otherDocumentType || null}
                      onValueChange={(value) => setOtherDocumentType(value || "")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select document type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Visa">Visa</SelectItem>
                        <SelectItem value="Insurance">Insurance</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    onClick={handleOtherDocumentUpload}
                    className="w-full px-6 font-normal sm:w-auto sm:min-w-[120px]"
                  >
                    Upload
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
      </main>

    </>
  );
}
