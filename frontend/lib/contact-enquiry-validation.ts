import type { ContactEnquiryPayload } from "./enquiries";

export const contactEnquiryFields = ["name", "email", "phone", "subject", "message"] as const;
export type ContactEnquiryField = typeof contactEnquiryFields[number];
export type ContactEnquiryErrors = Partial<Record<ContactEnquiryField, string>>;

export function validateContactEnquiry(values: Record<ContactEnquiryField, string>) {
  const name = values.name.trim();
  const email = values.email.trim();
  const localPhone = values.phone.trim();
  const digits = localPhone.replace(/\D/g, "");
  const phone = `+91${digits}`;
  const subject = values.subject.trim();
  const message = values.message.trim();
  const errors: ContactEnquiryErrors = {};
  if (!name) errors.name = "Full Name is required.";
  else if (name.length > 160) errors.name = "Full Name must be 160 characters or fewer.";
  if (!email) errors.email = "Email Address is required.";
  else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";
  if (!localPhone) errors.phone = "Phone Number is required.";
  else if (!/^[\d\s()-]+$/.test(localPhone) || digits.length < 6 || !/^\+[1-9]\d{6,14}$/.test(phone)) errors.phone = "Enter a valid phone number.";
  if (!subject) errors.subject = "Subject is required.";
  else if (subject.length > 200) errors.subject = "Subject must be 200 characters or fewer.";
  if (!message) errors.message = "Your Message is required.";
  else if (message.length > 3000) errors.message = "Your Message must be 3000 characters or fewer.";
  const payload: ContactEnquiryPayload = { name, email, phone, subject, message };
  return { errors, payload };
}
