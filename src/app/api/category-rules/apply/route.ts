import { NextResponse } from "next/server";
import { categoryRuleService } from "@/services/categoryRuleService";

export async function POST() {
  const result = await categoryRuleService.applyToExistingEntries();
  return NextResponse.json(result);
}
