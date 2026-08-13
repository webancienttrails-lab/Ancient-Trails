import {
  model,
  models,
  Schema,
  type HydratedDocument,
  type Model,
} from "mongoose";

export interface IExpert {
  expertId: string;
  fullName: string;
  image: string;
  fullBiography: string;
  expertiseTags: string[];
  qualifications: string[];
  languages: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type ExpertDocument = HydratedDocument<IExpert>;

const trimmedString = {
  type: String,
  trim: true,
  default: "",
};

const requiredTrimmedString = {
  type: String,
  required: true,
  trim: true,
};

const trimmedStringList = {
  type: [String],
  default: [],
  set: (values: string[]) =>
    Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))),
};

const expertSchema = new Schema<IExpert>(
  {
    expertId: {
      ...requiredTrimmedString,
      uppercase: true,
      maxlength: 40,
    },
    fullName: {
      ...requiredTrimmedString,
      maxlength: 120,
    },
    image: {
      ...trimmedString,
      maxlength: 500,
    },
    fullBiography: {
      ...trimmedString,
      maxlength: 3000,
    },
    expertiseTags: trimmedStringList,
    qualifications: trimmedStringList,
    languages: trimmedStringList,
  },
  {
    timestamps: true,
  }
);

expertSchema.index({ expertId: 1 }, { unique: true });
expertSchema.index({
  fullName: "text",
  image: "text",
  fullBiography: "text",
  expertiseTags: "text",
  qualifications: "text",
  languages: "text",
});

export const Expert =
  (models.Expert as Model<IExpert> | undefined) ||
  model<IExpert>("Expert", expertSchema);
