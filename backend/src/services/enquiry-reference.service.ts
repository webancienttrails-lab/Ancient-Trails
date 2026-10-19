import { mongo } from "mongoose";
import { Enquiry } from "../models/enquiry.model";
import { EnquiryReferenceCounter } from "../models/enquiryReferenceCounter.model";

const counterFilter = { _id: "enquiry" };
let preparation: Promise<void> | undefined;

export async function allocateEnquiryReference(): Promise<string> {
  let counter;
  try {
    counter = await EnquiryReferenceCounter.findOneAndUpdate(
      counterFilter, { $inc: { value: 1 } }, { new: true, upsert: true }
    );
  } catch (error) {
    if (!(error instanceof mongo.MongoServerError) || error.code !== 11000) throw error;
    counter = await EnquiryReferenceCounter.findOneAndUpdate(
      counterFilter, { $inc: { value: 1 } }, { new: true }
    );
  }
  if (!counter || !Number.isSafeInteger(counter.value) || counter.value < 1) {
    throw new Error("Enquiry reference could not be generated");
  }
  return `EN${String(counter.value).padStart(4, "0")}`;
}

async function backfillReferences(): Promise<void> {
  // Preserve assigned references and resume above the highest stored number.
  let highest = 0;
  const assigned = Enquiry.find({ enquiryReference: /^EN[0-9]+$/ })
    .select("enquiryReference").lean().cursor();
  for await (const enquiry of assigned) {
    highest = Math.max(highest, Number(enquiry.enquiryReference!.slice(2)));
  }
  try {
    await EnquiryReferenceCounter.updateOne(counterFilter, { $max: { value: highest } }, { upsert: true });
  } catch (error) {
    if (!(error instanceof mongo.MongoServerError) || error.code !== 11000) throw error;
    await EnquiryReferenceCounter.updateOne(counterFilter, { $max: { value: highest } });
  }

  const missing = { $or: [
    { enquiryReference: { $exists: false } },
    { enquiryReference: null },
    { enquiryReference: "" },
  ] };
  const enquiries = Enquiry.find(missing).sort({ createdAt: 1, _id: 1 }).select("_id").lean().cursor();
  for await (const enquiry of enquiries) {
    const enquiryReference = await allocateEnquiryReference();
    // A concurrent worker may already have assigned this record.
    await Enquiry.updateOne({ _id: enquiry._id, ...missing }, { $set: { enquiryReference } }, { timestamps: false });
  }
}

export function ensureEnquiryReferences(): Promise<void> {
  if (!preparation) {
    preparation = backfillReferences().catch((error: unknown) => {
      preparation = undefined;
      throw error;
    });
  }
  return preparation;
}
