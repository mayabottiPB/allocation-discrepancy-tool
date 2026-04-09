import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { UserFeedback, RefineResponse } from "@/lib/types";

const client = new Anthropic();

interface RefineRequestBody {
  feedback: UserFeedback;
  uniqueStyles: string[]; // "StyleNumber | StyleDescription" list from the spreadsheet
}

export async function POST(req: NextRequest) {
  try {
    const body: RefineRequestBody = await req.json();
    const { feedback, uniqueStyles } = body;

    const MAX_STYLES = 800;
    const styleList = uniqueStyles.slice(0, MAX_STYLES).join("\n");

    const prompt = `A retail allocation analyst reviewed an AI-generated result and found incorrect SKUs were included.
Your job is to identify the CORRECT style number to use for this result.

## Original Result
- Store: ${feedback.storeNumber} (${feedback.storeName})
- Style that was matched: "${feedback.originalStyle}"
- All SKUs that were included: ${feedback.originalSkus.join(", ")}

## User Feedback
- SKUs the user confirmed are CORRECT: ${feedback.correctSkus.length ? feedback.correctSkus.join(", ") : "(none specified)"}
- SKUs the user flagged as WRONG: ${feedback.wrongSkus.length ? feedback.wrongSkus.join(", ") : "(none specified)"}
- User's note: "${feedback.note || "(no note)"}"

## Known Styles in the Spreadsheet
Format: "StyleNumber | StyleDescription"
${styleList}

## Task
Based on the correct SKUs and user note, determine the single correct Style Number that should have been used.
- The correct SKUs start with a prefix that matches their Style Number (e.g. SKU "KT0100091402" belongs to style "KT0100091")
- Identify which Style Number from the known styles list corresponds to the correct SKUs
- Return the exact style number and description from the known styles list

Respond with ONLY this JSON (no markdown):
{
  "correctedStyleNumber": "<style number string, e.g. KT0100091>",
  "correctedStyleDescription": "<style description, e.g. KIDS DAX BORDER STRIPE KNIT POLO>",
  "explanation": "<one sentence explaining what was wrong and what the correct style is>"
}`;

    const message = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText =
      message.content[0].type === "text" ? message.content[0].text : "{}";

    try {
      const cleaned = rawText
        .replace(/^```[a-z]*\n?/i, "")
        .replace(/```$/i, "")
        .trim();
      const result = JSON.parse(cleaned) as RefineResponse;
      return NextResponse.json<RefineResponse>(result);
    } catch {
      return NextResponse.json<RefineResponse>(
        {
          correctedStyleNumber: null,
          correctedStyleDescription: null,
          explanation: "AI returned unparseable response.",
          error: "parse_error",
        },
        { status: 200 }
      );
    }
  } catch (err) {
    console.error("[/api/refine]", err);
    return NextResponse.json<RefineResponse>(
      {
        correctedStyleNumber: null,
        correctedStyleDescription: null,
        explanation: String(err),
        error: String(err),
      },
      { status: 500 }
    );
  }
}
