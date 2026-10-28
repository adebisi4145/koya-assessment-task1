/** An expected failure that maps directly to an HTTP status and `{"error": message}` body. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (message: string) => new AppError(400, message);
export const unauthorized = () => new AppError(401, "missing or invalid API key");
export const notFound = (message: string) => new AppError(404, message);
export const conflict = (message: string) => new AppError(409, message);
export const unprocessable = (message: string) => new AppError(422, message);
export const tooManyRequests = (retryAfterSeconds: number) =>
  new AppError(429, "too many booking attempts for this email, try again later", {
    "Retry-After": String(retryAfterSeconds),
  });
