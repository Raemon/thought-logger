import { afterAll, beforeAll, vi } from "vitest";

beforeAll(() => {
  vi.useFakeTimers();
  const date = new Date(2025, 8, 19);
  vi.setSystemTime(date);
});

afterAll(() => {
  vi.useRealTimers();
});
