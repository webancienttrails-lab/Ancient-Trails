import "dotenv/config";
import mongoose from "mongoose";
import { ensureEnquiryReferences } from "../services/enquiry-reference.service";

async function run() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing");
  try {
    await mongoose.connect(process.env.DATABASE_URL, { serverSelectionTimeoutMS: 10000 });
    await ensureEnquiryReferences();
    console.log("Existing enquiries now have permanent EN references.");
  } finally {
    await mongoose.disconnect();
  }
}
void run().catch(() => {
  console.error("Enquiry reference migration failed; check database connectivity and configuration.");
  process.exitCode = 1;
});
