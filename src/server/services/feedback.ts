import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { z } from "zod";
import type { FeedbackResponse, feedbackRequest } from "@/lib/api/contracts";
import { DATA_DIR } from "../db";
import { ServiceError } from "../http";
import { newId } from "../ids";
import { insertFeedback } from "../repositories/feedback";
import { findVenue } from "../repositories/venues";
import { analyzeSentiment } from "./sentiment";

const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

/** The client re-encodes every photo as JPEG; anything else is refused. */
function saveImage(id: string, base64: string): string {
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) throw new ServiceError(400, "Image is too large");
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) throw new ServiceError(400, "Image must be a JPEG");
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const file = path.join(UPLOAD_DIR, `${id}.jpg`);
  fs.writeFileSync(file, bytes);
  return path.relative(DATA_DIR, file);
}

export async function submitFeedback(input: z.output<typeof feedbackRequest>): Promise<FeedbackResponse> {
  const venue = findVenue(input.venueId);
  if (!venue) throw new ServiceError(404, "Venue not found");
  const id = newId("fbk");
  const imagePath = input.imageBase64 ? saveImage(id, input.imageBase64) : null;
  const sentimentScore = await analyzeSentiment(input.text);
  insertFeedback({ id, venueId: venue.id, text: input.text, sentiment: sentimentScore, source: input.source ?? null, imagePath });
  return { id, sentimentScore };
}
