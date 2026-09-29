import "server-only";
import { getDb } from "../db";

export interface NewFeedback {
  id: string;
  venueId: string;
  text: string;
  sentiment: number;
  source: string | null;
  imagePath: string | null;
}

export function insertFeedback(input: NewFeedback) {
  getDb()
    .prepare("INSERT INTO feedback (id, venue_id, text, sentiment, source, image_path) VALUES (?, ?, ?, ?, ?, ?)")
    .run(input.id, input.venueId, input.text, input.sentiment, input.source, input.imagePath);
}
