import {
  model,
  models,
  Schema,
  type HydratedDocument,
  type Model,
} from "mongoose";

export type AboutStatIcon =
  | "BookOpen"
  | "CalendarDays"
  | "Globe2"
  | "MapPin"
  | "Users";

export interface IAboutStat {
  label: string;
  value: string;
  icon: AboutStatIcon;
  sortOrder: number;
}

export interface IAboutTeamMember {
  name: string;
  role: string;
  bio: string;
  image: string;
  sortOrder: number;
}

export interface IAboutPage {
  pageKey: string;
  stats: IAboutStat[];
  teamMembers: IAboutTeamMember[];
  createdAt: Date;
  updatedAt: Date;
}

export type AboutPageDocument = HydratedDocument<IAboutPage>;

const trimmedString = {
  type: String,
  trim: true,
  default: "",
};

const aboutStatSchema = new Schema<IAboutStat>(
  {
    label: {
      ...trimmedString,
      maxlength: 80,
      required: true,
    },
    value: {
      ...trimmedString,
      maxlength: 30,
      required: true,
    },
    icon: {
      type: String,
      enum: ["BookOpen", "CalendarDays", "Globe2", "MapPin", "Users"],
      default: "BookOpen",
      required: true,
    },
    sortOrder: {
      type: Number,
      min: 0,
      max: 999,
      default: 0,
    },
  },
  {
    _id: true,
  }
);

const aboutTeamMemberSchema = new Schema<IAboutTeamMember>(
  {
    name: {
      ...trimmedString,
      maxlength: 120,
      required: true,
    },
    role: {
      ...trimmedString,
      maxlength: 120,
      required: true,
    },
    bio: {
      ...trimmedString,
      maxlength: 500,
      required: true,
    },
    image: {
      ...trimmedString,
      maxlength: 500,
    },
    sortOrder: {
      type: Number,
      min: 0,
      max: 999,
      default: 0,
    },
  },
  {
    _id: true,
  }
);

const aboutPageSchema = new Schema<IAboutPage>(
  {
    pageKey: {
      ...trimmedString,
      default: "about",
      immutable: true,
      required: true,
    },
    stats: {
      type: [aboutStatSchema],
      default: [],
    },
    teamMembers: {
      type: [aboutTeamMemberSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

aboutPageSchema.index({ pageKey: 1 }, { unique: true });

export const AboutPage =
  (models.AboutPage as Model<IAboutPage> | undefined) ||
  model<IAboutPage>("AboutPage", aboutPageSchema);
