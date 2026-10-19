import {
  model,
  models,
  Schema,
  type HydratedDocument,
  type Model,
} from "mongoose";

export enum EnquirySource {
  CONTACT_FORM = "Contact Form",
  EMAIL = "Email",
  PHONE_CALL = "Phone Call",
  WEBSITE = "Website",
}

export enum EnquiryStatus {
  CLOSED = "Closed",
  IN_PROGRESS = "In Progress",
  NEW = "New",
  REPLIED = "Replied",
}

export interface IEnquiry {
  enquiryReference?: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  socialMediaReferral: string;
  source: EnquirySource;
  status: EnquiryStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type EnquiryDocument = HydratedDocument<IEnquiry>;

const trimmedString = {
  type: String,
  trim: true,
  default: "",
};

const enquirySchema = new Schema<IEnquiry>(
  {
    enquiryReference: { type: String, trim: true },
    name: {
      ...trimmedString,
      maxlength: 160,
    },
    email: {
      ...trimmedString,
      lowercase: true,
      maxlength: 254,
    },
    phone: {
      ...trimmedString,
      maxlength: 24,
    },
    subject: {
      ...trimmedString,
      maxlength: 200,
    },
    message: {
      ...trimmedString,
      maxlength: 3000,
    },
    socialMediaReferral: {
      ...trimmedString,
      maxlength: 160,
    },
    source: {
      type: String,
      enum: Object.values(EnquirySource),
      default: EnquirySource.WEBSITE,
    },
    status: {
      type: String,
      enum: Object.values(EnquiryStatus),
      default: EnquiryStatus.NEW,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

enquirySchema.index({ enquiryReference: 1 }, { unique: true, partialFilterExpression: { enquiryReference: { $type: "string" } } });
enquirySchema.index({ status: 1 });
enquirySchema.index({ createdAt: -1 });
enquirySchema.index({
  email: "text",
  message: "text",
  name: "text",
  phone: "text",
  subject: "text",
});

export const Enquiry =
  (models.Enquiry as Model<IEnquiry> | undefined) ||
  model<IEnquiry>("Enquiry", enquirySchema);
