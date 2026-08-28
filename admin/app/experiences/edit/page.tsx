import { Suspense } from "react";

import { ExperienceEditorQueryPage } from "../_components/experience-editor-query-page";

export default function EditExperiencePage() {
  return (
    <Suspense fallback={null}>
      <ExperienceEditorQueryPage mode="edit" />
    </Suspense>
  );
}
