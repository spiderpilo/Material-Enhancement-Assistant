import { getApiBaseUrl } from "@/lib/api/course-content";

export type QuizOption = {
  id: string;
  label: string;
  text: string;
  explanation: string;
};

export type QuizQuestion = {
  id: string;
  prompt: string;
  options: QuizOption[];
  correct_option_id: string;
  explanation: string;
};

export type GeneratedQuiz = {
  quiz_id: string;
  title: string;
  source_count: number;
  questions: QuizQuestion[];
};

export async function generateQuiz({
  accessToken,
  materialIds,
  questionCount = 12,
}: {
  accessToken: string;
  materialIds: number[];
  questionCount?: number;
}): Promise<GeneratedQuiz> {
  const response = await fetch(`${getApiBaseUrl()}/quiz/generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      material_ids: materialIds,
      question_count: questionCount,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as
    | GeneratedQuiz
    | { detail?: string };

  if (!response.ok) {
    throw new Error(
      "detail" in payload && payload.detail
        ? payload.detail
        : "Unable to generate quiz.",
    );
  }

  return payload as GeneratedQuiz;
}
