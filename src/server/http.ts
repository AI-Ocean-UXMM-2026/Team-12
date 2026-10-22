import { ZodError } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { AppError } from "./errors";
export async function endpoint(work: () => Promise<unknown>) {
  try {
    return Response.json(
      { data: await work() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (!(error instanceof AppError) && !(error instanceof ZodError))
      console.error("Request failure", {
        type: error instanceof Error ? error.constructor.name : "Unknown",
        code:
          typeof error === "object" && error && "code" in error
            ? error.code
            : undefined,
        sqlState:
          error instanceof Prisma.PrismaClientKnownRequestError
            ? error.meta?.code
            : undefined,
        metaKeys:
          error instanceof Prisma.PrismaClientKnownRequestError
            ? Object.keys(error.meta ?? {})
            : undefined,
      });
    let status = 500,
      message = "The request could not be completed. Please retry.";
    if (error instanceof AppError) {
      status = error.status;
      message = error.message;
    }
    if (error instanceof ZodError) {
      status = 422;
      message = error.issues
        .map((x) => `${x.path.join(".")}: ${x.message}`)
        .join("; ");
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2002", "P2034"].includes(error.code)
    ) {
      status = 409;
      message = "The record changed or already exists. Reload and review.";
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      status = 404;
      message = "Record unavailable.";
    }
    return Response.json(
      { error: { code: String(status), message } },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
