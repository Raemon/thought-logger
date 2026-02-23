import { getSecret } from "./credentials";
import { OPEN_ROUTER } from "../constants/credentials";

export async function getAvailableModels(
  imageSupport = false,
): Promise<string[]> {
  const apiKey = await getSecret(OPEN_ROUTER);
  const response = await fetch("https://openrouter.ai/api/v1/models", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://github.com/raymondarnold/thought-logger",
      "X-Title": "ThoughtLogger",
    },
  });

  const body = await response.json();
  return body.data
    .filter(
      (model: {
        id: string;
        architecture: {
          input_modalities: string[];
        };
        supported_parameters: string[];
      }) =>
        !imageSupport ||
        (model.architecture.input_modalities.includes("image") &&
          model.supported_parameters.includes("structured_outputs") &&
          !model.id.startsWith("google/gemini")),
    )
    .map((model: { id: string }) => model.id);
}
