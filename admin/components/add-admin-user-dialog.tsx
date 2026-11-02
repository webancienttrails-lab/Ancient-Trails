"use client";

import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { adminTabOptions } from "@/lib/admin-access";
import { createAdminUser, type AdminDirectoryUser } from "@/lib/users";

export function AddAdminUserDialog({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (user: AdminDirectoryUser) => void;
}) {
  const toast = useToast();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [profession, setProfession] = useState("");
  const [email, setEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [role, setRole] = useState<"admin" | "staff">("admin");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [tabs, setTabs] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const inputClass = "h-10 rounded-sm border border-border px-3 text-sm font-normal outline-none focus:border-primary";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    setError("");
    if (!tabs.length) { setError("Select at least one dashboard tab."); return; }
    setIsSaving(true);
    try {
      const response = await createAdminUser({ firstName: firstName.trim(), lastName: lastName.trim(), profession: profession.trim(), email: email.trim().toLowerCase(), mobileNumber: mobileNumber.trim(), role, password, adminTabs: tabs });
      setPassword("");
      onCreated(response.data.user);
      toast.success("User access granted", response.message);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to create admin user.");
    } finally { setIsSaving(false); }
  }

  return <Dialog open onOpenChange={(open) => { if (!open && !isSaving) onClose(); }}>
    <DialogContent showCloseButton={!isSaving} className="flex h-[90dvh] max-h-[90dvh] flex-col overflow-hidden sm:max-w-lg">
      <DialogHeader className="shrink-0 border-b border-border pb-3 pr-8">
        <DialogTitle>Add Admin User</DialogTitle>
        <DialogDescription>Create a profile and choose the dashboard tabs this user can access.</DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} data-admin-ignore-save-reminder="true" className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <fieldset disabled={isSaving} className="min-h-0 flex-1 space-y-4 overflow-y-auto pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-semibold">First Name
              <input required autoComplete="given-name" maxLength={80} value={firstName} onChange={(event) => setFirstName(event.target.value)} className={inputClass} />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold">Last Name
              <input autoComplete="family-name" maxLength={80} value={lastName} onChange={(event) => setLastName(event.target.value)} className={inputClass} />
            </label>
          </div>
          <label className="grid gap-1.5 text-xs font-semibold">Profession
            <input maxLength={120} placeholder="e.g. Accountant" value={profession} onChange={(event) => setProfession(event.target.value)} className={inputClass} />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold">Email
            <input required type="email" autoComplete="off" maxLength={254} placeholder="name@company.com" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} />
            <span className="font-normal text-foreground/60">If this email already has an account, dashboard access will be added to it.</span>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-semibold">Phone Number
              <input type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} value={mobileNumber} onChange={(event) => setMobileNumber(event.target.value.replace(/\D/g, "").slice(0, 10))} className={inputClass} placeholder="10 digits" />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold">Role
              <select value={role} onChange={(event) => setRole(event.target.value as "admin" | "staff")} className={inputClass}>
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
              </select>
            </label>
          </div>
          <label className="grid gap-1.5 text-xs font-semibold">Password
            <span className="relative block">
              <input required type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={12} maxLength={72} value={password} onChange={(event) => setPassword(event.target.value)} className={`${inputClass} w-full pr-11`} />
              <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className="absolute inset-y-0 right-2 grid w-8 place-items-center rounded-full text-foreground/55 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </span>
            <span className="font-normal text-foreground/60">Use at least 12 characters.</span>
          </label>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-xs font-semibold">Dashboard Tab Access</legend>
            <div className="grid grid-cols-2 gap-2">
              {adminTabOptions.map((tab) => <label key={tab.key} className="flex items-center gap-2 rounded-sm border border-border px-3 py-2 text-xs font-medium">
                <input type="checkbox" checked={tabs.includes(tab.key)} onChange={(event) => setTabs((current) => event.target.checked ? [...current, tab.key] : current.filter((key) => key !== tab.key))} className="size-4 accent-primary" />
                {tab.label}
              </label>)}
            </div>
          </fieldset>
        </fieldset>
        {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
        <DialogFooter className="shrink-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button type="submit" disabled={isSaving}>{isSaving ? "Creating..." : "Create Admin User"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
