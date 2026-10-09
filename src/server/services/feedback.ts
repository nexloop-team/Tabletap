import "server-only";
import type { z } from "zod";
import type { FeedbackResponse, feedbackRequest } from "@/lib/api/contracts";
import { ServiceError } from "../http";
import { newId } from "../ids";
import { insertFeedback } from "../repositories/feedback";
import { findVenue } from "../repositories/venues";
import { storage } from "../storage";
import { analyzeSentiment } from "./sentiment";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

/** The client re-encodes every photo as JPEG; anything else is refused. Returns its storage key. */
async function saveImage(id: string, base64: string): Promise<string> {
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) throw new ServiceError(400, "Image is too large");
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) throw new ServiceError(400, "Image must be a JPEG");
  const key = `uploads/${id}.jpg`;
  await storage().put(key, bytes, "image/jpeg");
  return key;
}

export async function submitFeedback(input: z.output<typeof feedbackRequest>): Promise<FeedbackResponse> {
  const venue = await findVenue(input.venueId);
  if (!venue) throw new ServiceError(404, "Venue not found");
  const id = newId("fbk");
  const imagePath = input.imageBase64 ? await saveImage(id, input.imageBase64) : null;
  const sentimentScore = await analyzeSentiment(input.text);
  await insertFeedback({ id, venueId: venue.id, text: input.text, sentiment: sentimentScore, source: input.source ?? null, imagePath });
  return { id, sentimentScore };
}
