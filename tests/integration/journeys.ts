import "dotenv/config";
import assert from "node:assert/strict";
import {setTimeout as delay} from "node:timers/promises";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const origin = process.env.APP_BASE_URL ?? "http://localhost:3000";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
class Client {
  cookies = new Map<string, string>();
  async request(
    path: string,
    body?: unknown,
    method = body === undefined ? "GET" : "POST",
    key?: string,
  ) {
    const multipart = body instanceof FormData;
    const response = await fetch(origin + path, {
      method,
      headers: {
        Origin: origin,
        Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "),
        ...(!multipart && body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      body:
        body === undefined
          ? undefined
          : multipart
            ? body
            : JSON.stringify(body),
      redirect: "manual",
    });
    for (const cookie of response.headers.getSetCookie()) {
      const part = cookie.split(";", 1)[0];
      const pos = part.indexOf("=");
      this.cookies.set(part.slice(0, pos), part.slice(pos + 1));
    }
    const result = await response.json().catch(() => null);
    return {
      status: response.status,
      data: result?.data ?? result,
      error: result?.error,
      retryAfter: Number(response.headers.get("retry-after")??10),
    };
  }
  async login(email: string, password = process.env.SEED_PASSWORD!) {
    for(let attempt=0;attempt<5;attempt++) {
      const r=await this.request("/api/auth/sign-in/email",{email,password});
      if(r.status!==429){assert.equal(r.status,200,JSON.stringify(r));return;}
      // Respect the real limiter when the suite provisions several accounts rapidly.
      await delay(Math.min(15,Math.max(1,r.retryAfter))*1000);
    }
    throw new Error("Login rate limit did not clear within the bounded test retry window.");
  }
}
const admin = new Client(),
  rider = new Client(),
  other = new Client(),
  customer = new Client(),
  second = new Client();
function ok(r: { status: number; error?: unknown }) {
  assert.equal(r.status, 200, JSON.stringify(r));
}
const api = "/api/v1/";
try {
  assert.equal((await admin.request(api + "admin/parcels")).status, 401);
  await admin.login("admin@parcel.test");
  await rider.login("rider1@parcel.test");
  await other.login("rider2@parcel.test");
  assert.equal((await rider.request(api + "admin/parcels")).status, 403);
  const profiles = await admin.request(api + "admin/riders");
  ok(profiles);
  assert(profiles.data.length >= 5);
  const first = profiles.data.find(
    (r: { user: { email: string } }) => r.user?.email === "rider1@parcel.test",
  );
  const nextProfiles = await admin.request(
    api + "admin/riders?name=Thiri%20Aye",
  );
  ok(nextProfiles);
  const next = nextProfiles.data.find(
    (r: { user: { email: string } }) => r.user?.email === "rider2@parcel.test",
  );
  const createdRider = await admin.request(api + "admin/riders", {
    name: "Integration Rider",
    contactNumber: "09970000123",
    vehicleType: "BICYCLE",
    vehicleNumber: "",
    email: `test-${randomUUID()}@parcel.test`,
  });
  ok(createdRider);
  assert(createdRider.data.setupPassword);
  const newProfile = await admin.request(
    api + `admin/riders/${createdRider.data.id}`,
  );
  const setup = new Client();
  await setup.login(
    newProfile.data.user.email,
    createdRider.data.setupPassword,
  );
  assert.equal((await setup.request(api + "rider/assignments")).status, 403);
  const newPassword = randomUUID() + randomUUID();
  ok(
    await setup.request(api + "password", {
      currentPassword: createdRider.data.setupPassword,
      newPassword,
    }),
  );
  ok(await setup.request(api + "rider/assignments"));
  console.info(
    "PASS identity, role authorization, provisioning and forced password setup",
  );
  const parcelInput = {
    senderName: "Integration sender",
    receivedDate: "2026-10-22",
    receivedPerson: "Integration operator",
    customerName: "Synthetic acceptance recipient",
    customerContactNumber: "09970000999",
    township: "Synthetic township",
    address: "Synthetic test address",
    paymentType: "COD",
    orderAmount: "100.00",
    deliveryFee: "10.00",
    deliveryNote: "Integration fixture",
  };
  assert.equal(
    (
      await admin.request(
        api + "admin/parcels",
        { ...parcelInput, orderAmount: "0" },
        "POST",
        randomUUID(),
      )
    ).status,
    422,
  );
  const key = randomUUID();
  const created = await admin.request(
    api + "admin/parcels",
    parcelInput,
    "POST",
    key,
  );
  ok(created);
  const id = created.data.id;
  const replay = await admin.request(
    api + "admin/parcels",
    parcelInput,
    "POST",
    key,
  );
  ok(replay);
  assert.equal(replay.data.id, id);
  assert.equal(
    (
      await admin.request(
        api + "admin/parcels",
        { ...parcelInput, customerName: "Different payload" },
        "POST",
        key,
      )
    ).status,
    409,
  );
  const detail = await admin.request(api + `admin/parcels/${id}`);
  ok(detail);
  assert(!("trackingCodeHash" in detail.data));
  assert(!("trackingCode" in detail.data));
  assert(!("smsStatus" in detail.data));
  const adminSearch=await admin.request(api+`admin/parcels?code=${encodeURIComponent(detail.data.parcelCode)}`);ok(adminSearch);
  assert.equal(adminSearch.data.length,1);assert.equal(adminSearch.data[0].id,id);
  assert.equal(await db.outboxEvent.count({where:{entityId:id}}),0);
  ok(
    await customer.request(api + "tracking/exchange", {
      code: detail.data.parcelCode,
    }),
  );
  const publicView = await customer.request(api + "tracking");
  ok(publicView);
  assert.equal(publicView.data.customerStatus, "PROCESSING_DELIVERY");
  for (const field of [
    "address",
    "customerName",
    "customerContactNumber",
    "trackingCode",
    "trackingCodeHash",
    "orderAmount",
    "riderId",
  ])
    assert(!(field in publicView.data));
  assert.equal((await second.request(api + "tracking")).status, 401);
  assert.equal(
    (await second.request(api + "tracking/exchange", { code: randomUUID() }))
      .status,
    404,
  );
  const assignment = {
    parcelId: id,
    riderId: first.id,
    assignDate: "2026-10-22",
    deliveryDate: "2026-10-22",
    version: detail.data.version,
    mode: "assign",
  };
  const assignKey = randomUUID();
  const assigned = await admin.request(
    api + "admin/assignments",
    assignment,
    "POST",
    assignKey,
  );
  ok(assigned);
  const aid = assigned.data.id;
  const assignmentReplay = await admin.request(
    api + "admin/assignments",
    assignment,
    "POST",
    assignKey,
  );
  ok(assignmentReplay);
  assert.equal(assignmentReplay.data.id, aid);
  const own = await rider.request(api + `rider/assignments/${aid}`);
  ok(own);
  assert.equal(own.data.expectedDeliveryDate.slice(0, 10), "2026-10-25");
  const ownList=await rider.request(api+`rider/assignments?date=2026-10-22&code=${encodeURIComponent(detail.data.parcelCode)}&rider=${next.id}`);ok(ownList);
  assert.equal(ownList.data.length,1);assert.equal(ownList.data[0].id,aid);assert.equal(ownList.data[0].riderId,first.id);
  const otherList=await other.request(api+`rider/assignments?date=2026-10-22&code=${encodeURIComponent(detail.data.parcelCode)}&rider=${first.id}`);ok(otherList);assert.deepEqual(otherList.data,[]);
  const anotherDate=await rider.request(api+`rider/assignments?date=2026-10-23&code=${encodeURIComponent(detail.data.parcelCode)}`);ok(anotherDate);assert.deepEqual(anotherDate.data,[]);
  assert.equal(
    (await other.request(api + `rider/assignments/${aid}`)).status,
    404,
  );
  const scope = await customer.request(api + "tracking");
  const prefs = {
    version: scope.data.version,
    receivingOption: "NEIGHBOUR",
    deliveryInstruction: "Ring twice.",
  };
  ok(await customer.request(api + "tracking/preferences", prefs));
  const refreshed = await customer.request(api + "tracking");
  const before = await db.riderNotification.count({ where: { parcelId: id } });
  ok(
    await customer.request(api + "tracking/preferences", {
      ...prefs,
      version: refreshed.data.version,
    }),
  );
  assert.equal(
    await db.riderNotification.count({ where: { parcelId: id } }),
    before,
  );
  assert.equal(
    (
      await customer.request(api + "tracking/preferences", {
        ...prefs,
        version: refreshed.data.version,
        parcelId: randomUUID(),
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await customer.request(api + "tracking/preferences", {
        ...prefs,
        deliveryInstruction: "Stale",
      })
    ).status,
    409,
  );
  ok(await customer.request(api+"tracking/preferences",{...prefs,version:refreshed.data.version,deliveryInstruction:"Ring twice. Use side gate."}));
  assert.equal(await db.riderNotification.count({where:{parcelId:id}}),before+1);
  const instructionNotice=await db.riderNotification.findFirstOrThrow({where:{parcelId:id,type:"INSTRUCTIONS_CHANGED"}});
  assert.equal((instructionNotice.snapshot as {message:string}).message,`${parcelInput.customerName} changed delivery instructions for ${detail.data.parcelCode}.`);
  const optionNotice=await db.riderNotification.findFirstOrThrow({where:{parcelId:id,type:"PREFERENCES_CHANGED"}});
  assert.equal((optionNotice.snapshot as {message:string}).message,`${parcelInput.customerName} changed receiving option for ${detail.data.parcelCode}.`);
  const latest = await rider.request(api + `rider/assignments/${aid}`);
  ok(latest);
  assert.equal(latest.data.parcel.deliveryInstruction, "Ring twice. Use side gate.");
  const notices = await rider.request(api + "rider/notifications");
  ok(notices);
  assert(
    notices.data.items.some((n: { parcelId: string }) => n.parcelId === id),
  );
  const filtered=await rider.request(api+`rider/notifications?date=2026-10-22&code=${encodeURIComponent(detail.data.parcelCode)}`);ok(filtered);
  assert(filtered.data.items.length>0);
  for(const n of filtered.data.items){assert.equal(n.snapshot.parcelCode,detail.data.parcelCode);assert.equal(n.deliveryDate.slice(0,10),"2026-10-22");}
  const notice=filtered.data.items[0];ok(await rider.request(api+`rider/notifications/${notice.id}/read`,{}));
  assert.equal((await rider.request(api+"rider/notifications")).data.unread,notices.data.unread-1);
  assert.equal((await other.request(api+`rider/notifications/${notice.id}/read`,{})).status,404);
  console.info(
    "PASS parcel validation, codes, idempotency, scoped tracking, preferences and notifications",
  );
  const resultKey = randomUUID();
  const unreachable = new FormData();
  unreachable.set("result", "CUSTOMER_UNREACHABLE");
  unreachable.set("version", String(latest.data.parcel.version));
  unreachable.set("idempotencyKey", resultKey);
  ok(
    await rider.request(api + `rider/assignments/${aid}/results`, unreachable),
  );
  ok(
    await rider.request(api + `rider/assignments/${aid}/results`, unreachable),
  );
  assert.equal(
    (await customer.request(api + "tracking")).data.customerStatus,
    "DELAY",
  );
  assert.equal(
    await db.deliveryAttempt.count({ where: { assignmentId: aid } }),
    1,
  );
  const now = await admin.request(api + `admin/parcels/${id}`);
  assert.equal(
    (
      await admin.request(api + `admin/riders/${first.id}`, {
        name: first.name,
        contactNumber: first.contactNumber,
        vehicleType: first.vehicleType,
        vehicleNumber: first.vehicleNumber ?? "",
        version: first.version,
        active: false,
      })
    ).status,
    409,
  );
  const moved = await admin.request(
    api + "admin/assignments",
    {
      ...assignment,
      riderId: next.id,
      version: now.data.version,
      mode: "reassign",
    },
    "POST",
    randomUUID(),
  );
  ok(moved);
  assert.equal(
    (await rider.request(api + `rider/assignments/${aid}`)).status,
    404,
  );
  assert.equal(
    (await rider.request(api + `rider/assignments/${aid}/results`, unreachable))
      .status,
    404,
  );
  const newAid = moved.data.id;
  const newOwn = await other.request(api + `rider/assignments/${newAid}`);
  ok(newOwn);
  const missing = new FormData();
  missing.set("result", "DELIVERED_HOME");
  missing.set("version", String(newOwn.data.parcel.version));
  missing.set("idempotencyKey", randomUUID());
  assert.equal(
    (await other.request(api + `rider/assignments/${newAid}/results`, missing))
      .status,
    422,
  );
  missing.set(
    "photo",
    new Blob(["forged PNG bytes"], { type: "image/png" }),
    "fake.png",
  );
  assert.equal(
    (await other.request(api + `rider/assignments/${newAid}/results`, missing))
      .status,
    422,
  );
  const image = await sharp({
    create: { width: 32, height: 32, channels: 3, background: "#4f7ab2" },
  })
    .png()
    .toBuffer();
  missing.set(
    "photo",
    new Blob([new Uint8Array(image)], { type: "image/png" }),
    "proof.png",
  );
  missing.set("idempotencyKey", randomUUID());
  const delivered = await other.request(
    api + `rider/assignments/${newAid}/results`,
    missing,
  );
  if (process.env.EXPECT_STORAGE === "true") {
    ok(delivered);
    ok(
      await other.request(api + `rider/assignments/${newAid}/results`, missing),
    );
    assert.equal(
      (await customer.request(api + "tracking")).data.customerStatus,
      "DELIVERED",
    );
    const proof = await db.deliveryAttempt.findFirstOrThrow({
      where: { assignmentId: newAid, result: "DELIVERED_HOME" },
    });
    assert(proof.photoAssetId);
    const stored = await db.photoAsset.findUniqueOrThrow({
      where: { id: proof.photoAssetId },
    });
    assert.equal(stored.lifecycle, "ATTACHED");
    const c = await customer.request(api + "tracking");
    assert.equal(
      (
        await customer.request(api + "tracking/preferences", {
          receivingOption: "HOME",
          deliveryInstruction: "",
          version: c.data.version,
        })
      ).status,
      409,
    );
    console.info(
      "PASS successful delivery with private persisted photo, replay and Delivered edit lock",
    );
  } else {
    assert.equal(delivered.status, 503, JSON.stringify(delivered));
    assert.equal(
      (await customer.request(api + "tracking")).data.customerStatus,
      "ON_THE_WAY",
    );
    console.info(
      "PASS storage failure prevents false delivery success; successful photo journey BLOCKED by unavailable object store",
    );
  }
  const found = await db.parcel.findUniqueOrThrow({ where: { id } });
  assert.equal(found.parcelCode, detail.data.parcelCode);
  assert.equal(await db.assignment.count({ where: { parcelId: id } }), 2);
  console.info(
    "PASS unreachable/retry, reassignment history, former-Rider denial, photo validation, persistent records",
  );
  const csrf = await fetch(origin + api + "tracking/exchange", {
    method: "POST",
    headers: {
      Origin: "https://untrusted.invalid",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code: detail.data.parcelCode }),
  });
  assert.equal(csrf.status, 403);
  const concurrentKey = randomUUID();
  const duplicates = await Promise.all([
    admin.request(api + "admin/parcels", parcelInput, "POST", concurrentKey),
    admin.request(api + "admin/parcels", parcelInput, "POST", concurrentKey),
  ]);
  duplicates.forEach(ok);
  assert.equal(duplicates[0].data.id, duplicates[1].data.id);
  const raceId = duplicates[0].data.id;
  const sameAssignment = { ...assignment, parcelId: raceId, version: 0 };
  const duplicateAssignmentKey = randomUUID();
  const dispatches = await Promise.all([
    admin.request(
      api + "admin/assignments",
      sameAssignment,
      "POST",
      duplicateAssignmentKey,
    ),
    admin.request(
      api + "admin/assignments",
      sameAssignment,
      "POST",
      duplicateAssignmentKey,
    ),
  ]);
  dispatches.forEach(ok);
  assert.equal(dispatches[0].data.id, dispatches[1].data.id);
  assert.equal(
    await db.assignment.count({
      where: { parcelId: raceId, lifecycle: "ACTIVE" },
    }),
    1,
  );
  const raceDetail = await admin.request(api + `admin/parcels/${raceId}`);
  ok(
    await second.request(api + "tracking/exchange", {
      code: raceDetail.data.parcelCode,
    }),
  );
  const beforeOther = await customer.request(api + "tracking");
  ok(
    await second.request(api + "tracking/preferences", {
      receivingOption: "DOOR",
      deliveryInstruction: "Second scope only",
      version: raceDetail.data.version,
    }),
  );
  assert.deepEqual(
    (await customer.request(api + "tracking")).data,
    beforeOther.data,
  );
  const current = await admin.request(api + `admin/parcels/${raceId}`);
  const raceDispatch = await Promise.all([
    admin.request(
      api + "admin/assignments",
      {
        ...sameAssignment,
        mode: "reassign",
        riderId: next.id,
        version: current.data.version,
      },
      "POST",
      randomUUID(),
    ),
    admin.request(
      api + "admin/assignments",
      {
        ...sameAssignment,
        mode: "reschedule",
        deliveryDate: "2026-10-23",
        version: current.data.version,
      },
      "POST",
      randomUUID(),
    ),
  ]);
  assert.deepEqual(raceDispatch.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    await db.assignment.count({
      where: { parcelId: raceId, lifecycle: "ACTIVE" },
    }),
    1,
  );
  const ownAttempt = await db.deliveryAttempt.findFirstOrThrow({
    where: { assignmentId: aid },
  });
  await assert.rejects(
    db.deliveryAttempt.update({
      where: { id: ownAttempt.id },
      data: { result: "CUSTOMER_UNREACHABLE" },
    }),
  );
  await assert.rejects(
    db.deliveryAttempt.create({
      data: {
        assignmentId: newAid,
        parcelId: id,
        riderId: first.id,
        result: "CUSTOMER_UNREACHABLE",
        idempotencyKey: randomUUID(),
      },
    }),
  );
  const oldCookie = second.cookies.get("parcel-tracking")!;
  second.cookies.set("parcel-tracking", randomUUID());
  assert.equal((await second.request(api + "tracking")).status, 401);
  second.cookies.set("parcel-tracking", oldCookie);
  const editedProfile = (
    await admin.request(api + `admin/riders/${createdRider.data.id}`)
  ).data;
  ok(
    await admin.request(api + `admin/riders/${createdRider.data.id}`, {
      name: editedProfile.name,
      contactNumber: editedProfile.contactNumber,
      vehicleType: editedProfile.vehicleType,
      vehicleNumber: editedProfile.vehicleNumber ?? "",
      version: editedProfile.version,
      active: false,
    }),
  );
  assert.equal((await setup.request(api + "rider/assignments")).status, 401);
  const inactiveLogin = await setup.request("/api/auth/sign-in/email", {
    email: newProfile.data.user.email,
    password: newPassword,
  });
  assert.notEqual(inactiveLogin.status, 200);
  console.info(
    "PASS concurrent idempotency, assignment races, second-scope isolation, CSRF, tampered session, immutable attempts, evidence Rider constraint and account revocation",
  );
} finally {
  await db.$disconnect();
}
