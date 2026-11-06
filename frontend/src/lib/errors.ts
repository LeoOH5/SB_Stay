// API 오류 — 실제 API 실패 형식 { error: { code, message } } 와 목업이 같은 클래스를 던진다.
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
