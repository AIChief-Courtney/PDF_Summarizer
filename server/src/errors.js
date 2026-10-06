export class AppError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function errorResponse(err) {
  if (err instanceof AppError) {
    return {
      status: err.statusCode,
      body: { error: { code: err.code, message: err.message } },
    };
  }
  return {
    status: 500,
    body: {
      error: {
        code: "SERVER_ERROR",
        message: "Something went wrong. Please try again.",
      },
    },
  };
}
