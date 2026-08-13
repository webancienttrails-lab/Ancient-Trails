import {
  model,
  models,
  Schema,
  type HydratedDocument,
  type Model,
} from "mongoose";

export enum BlogCategory {
  HERITAGE = "Heritage",
  HISTORY = "History",
  ART_AND_CULTURE = "Art & Culture",
  TRAVEL_GUIDE = "Travel Guide",
  DESTINATIONS = "Destinations",
  TRAVEL_TIPS = "Travel Tips",
  UNCATEGORIZED = "Uncategorized",
}

export enum BlogStatus {
  PUBLISHED = "Published",
  DRAFT = "Draft",
  ARCHIVED = "Archived",
}

export interface IBlogPost {
  blogId: string;
  title: string;
  slug: string;
  category: BlogCategory;
  content: string;
  quote: string;
  authorName: string;
  heroImage: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  status: BlogStatus;
  readTimeMinutes: number;
  popularRank: number;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type BlogDocument = HydratedDocument<IBlogPost>;

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

const blogSchema = new Schema<IBlogPost>(
  {
    blogId: {
      ...requiredTrimmedString,
      uppercase: true,
      maxlength: 40,
    },
    title: {
      ...requiredTrimmedString,
      maxlength: 180,
    },
    slug: {
      ...requiredTrimmedString,
      lowercase: true,
      maxlength: 220,
    },
    category: {
      type: String,
      enum: Object.values(BlogCategory),
      required: true,
      default: BlogCategory.UNCATEGORIZED,
    },
    content: {
      ...trimmedString,
      maxlength: 30000,
    },
    quote: {
      ...trimmedString,
      maxlength: 500,
    },
    authorName: {
      ...trimmedString,
      maxlength: 120,
      default: "Ancient Trails",
    },
    heroImage: {
      ...trimmedString,
      maxlength: 500,
    },
    seoTitle: {
      ...trimmedString,
      maxlength: 70,
    },
    seoDescription: {
      ...trimmedString,
      maxlength: 170,
    },
    seoKeywords: {
      ...trimmedString,
      maxlength: 300,
    },
    canonicalUrl: {
      ...trimmedString,
      maxlength: 500,
    },
    ogTitle: {
      ...trimmedString,
      maxlength: 95,
    },
    ogDescription: {
      ...trimmedString,
      maxlength: 220,
    },
    ogImage: {
      ...trimmedString,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: Object.values(BlogStatus),
      required: true,
      default: BlogStatus.DRAFT,
    },
    readTimeMinutes: {
      type: Number,
      min: 1,
      max: 120,
      required: true,
      default: 5,
    },
    popularRank: {
      type: Number,
      min: 0,
      max: 999,
      required: true,
      default: 0,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

blogSchema.index({ blogId: 1 }, { unique: true });
blogSchema.index({ slug: 1 }, { unique: true });
blogSchema.index({
  title: "text",
  content: "text",
  seoTitle: "text",
  seoDescription: "text",
  seoKeywords: "text",
});
blogSchema.index({ category: 1, status: 1 });
blogSchema.index({ status: 1, publishedAt: -1 });
blogSchema.index({ popularRank: 1 });

export const BlogPost =
  (models.BlogPost as Model<IBlogPost> | undefined) ||
  model<IBlogPost>("BlogPost", blogSchema);
