"use client";

import { useSearchParams } from "next/navigation";

import {
  ExperienceEditorPage,
  type ExperienceEditorMode,
} from "./experience-editor-page";

type QueryEditorMode = Exclude<ExperienceEditorMode, "add">;

export function ExperienceEditorQueryPage({
  mode,
}: {
  mode: QueryEditorMode;
}) {
  const searchParams = useSearchParams();
  const experienceId = searchParams.get("id") || undefined;

  return <ExperienceEditorPage experienceId={experienceId} mode={mode} />;
}
