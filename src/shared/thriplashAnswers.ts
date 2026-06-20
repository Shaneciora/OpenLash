export function thriplashAnswerLines(answers: { text: string }[]): string[] {
  return answers.map((a) => a.text.trim()).filter((text) => text.length > 0);
}

export function formatThriplashAnswers(answers: { text: string }[]): string {
  return thriplashAnswerLines(answers).join("\n");
}

export function hasSubmittedThriplashAnswers(answersA: { text: string }[]): boolean {
  return answersA.length >= 3;
}
