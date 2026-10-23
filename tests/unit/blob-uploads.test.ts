import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  actor: vi.fn(), rateLimit: vi.fn(),
  findTicket: vi.fn(), createTicket: vi.fn(), findAssignment: vi.fn(),
  get: vi.fn(), submit: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/server/security", () => ({ actor: mocks.actor, rateLimit: mocks.rateLimit }));
vi.mock("@/lib/db", () => ({ getDb: () => ({
  photoUploadTicket: { findFirst: mocks.findTicket, create: mocks.createTicket },
  assignment: { findFirst: mocks.findAssignment },
}) }));
vi.mock("@/lib/storage", () => ({ getPrivateStore: () => ({ get: mocks.get }) }));
vi.mock("@/server/services/photos", () => ({ submitResult: mocks.submit }));
import { authorizeBlobToken, createPhotoUpload, submitBlobResult } from "@/server/services/blob-uploads";

const ticketId = "4cb8e6e0-4326-477b-8767-92cd88ad319e";
const assignmentId = "a8155553-0123-4012-a333-3eab2e14c592";
const key = "test-result-idempotency-key";
const ticket = () => ({ id: ticketId, storageKey: `staging/${ticketId}`, assignmentId,
  userId: "user", idempotencyKey: key, createdAt: new Date(), expiresAt: new Date(Date.now() + 86400000) });
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("STORAGE_ADAPTER", "vercel-blob");
  mocks.actor.mockResolvedValue({ id: "user", rider: { id: "rider" } });
  mocks.findAssignment.mockResolvedValue({ id: assignmentId });
  mocks.findTicket.mockResolvedValue(ticket());
  mocks.createTicket.mockImplementation(async ({ data }) => data);
});
afterEach(() => vi.unstubAllEnvs());

describe("private direct upload authorization", () => {
  it("binds upload permission to current Rider, assignment and one immutable path", async () => {
    const result = await createPhotoUpload(assignmentId, { idempotencyKey: key });
    expect(result.mode).toBe("blob");
    expect(mocks.findAssignment).toHaveBeenCalledWith(expect.objectContaining({ where:
      expect.objectContaining({ riderId: "rider", lifecycle: "ACTIVE", parcel:
        expect.objectContaining({ currentAssignmentId: assignmentId }) }) }));
    const grant = await authorizeBlobToken(`staging/${ticketId}`, JSON.stringify({ ticketId }));
    expect(grant).toMatchObject({ maximumSizeInBytes: 10485760, allowedContentTypes: ["image/jpeg", "image/png"],
      allowOverwrite: false, addRandomSuffix: false });
    expect(grant.validUntil).toBeLessThanOrEqual(Date.now() + 900000);
  });
  it("rejects forged paths, another user's ticket, expired permissions and lost assignments", async () => {
    await expect(authorizeBlobToken("proof/existing.jpg", JSON.stringify({ ticketId }))).rejects.toMatchObject({ status: 404 });
    mocks.findTicket.mockResolvedValueOnce(null);
    await expect(authorizeBlobToken(`staging/${ticketId}`, JSON.stringify({ ticketId }))).rejects.toMatchObject({ status: 404 });
    mocks.findTicket.mockResolvedValueOnce({ ...ticket(), createdAt: new Date(Date.now() - 901000) });
    await expect(authorizeBlobToken(`staging/${ticketId}`, JSON.stringify({ ticketId }))).rejects.toMatchObject({ status: 410 });
    mocks.findAssignment.mockResolvedValueOnce(null);
    await expect(authorizeBlobToken(`staging/${ticketId}`, JSON.stringify({ ticketId }))).rejects.toMatchObject({ status: 404 });
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("denies inactive accounts before issuing permissions", async () => {
    mocks.actor.mockRejectedValueOnce(Object.assign(new Error("Inactive"), { status: 401 }));
    await expect(createPhotoUpload(assignmentId, { idempotencyKey: key })).rejects.toMatchObject({ status: 401 });
    expect(mocks.createTicket).not.toHaveBeenCalled();
  });
  it("rechecks ownership before reading bytes and uses the existing transactional result service", async () => {
    const input = { result: "DELIVERED_HOME", version: 3, idempotencyKey: key, uploadId: ticketId };
    mocks.findAssignment.mockResolvedValueOnce(null);
    await expect(submitBlobResult(assignmentId, input)).rejects.toMatchObject({ status: 404 });
    expect(mocks.get).not.toHaveBeenCalled();
    mocks.get.mockResolvedValue(new Uint8Array([1, 2, 3]));
    await submitBlobResult(assignmentId, input);
    const form = mocks.submit.mock.calls[0][1] as FormData;
    expect(form.get("version")).toBe("3");
    expect(form.get("photo")).toBeInstanceOf(File);
    expect(mocks.findTicket).toHaveBeenCalledWith({ where: expect.objectContaining({ userId: "user", assignmentId, idempotencyKey: key }) });
  });
  it("does not finalize when storage fails", async () => {
    mocks.get.mockRejectedValueOnce(new Error("Storage unavailable"));
    await expect(submitBlobResult(assignmentId, { result: "DELIVERED_HOME", version: 0,
      idempotencyKey: key, uploadId: ticketId })).rejects.toThrow("Storage unavailable");
    expect(mocks.submit).not.toHaveBeenCalled();
  });
});
