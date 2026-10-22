import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { businessToday } from "../../src/lib/dates";
test.setTimeout(120000);
// Reuse successful seed-account sessions in memory; do not weaken production login limits.
const sessions=new Map<string,Awaited<ReturnType<BrowserContext["storageState"]>>>();
async function login(
  page: Page,
  email: string,
  password = process.env.SEED_PASSWORD!,
) {
  const existing=sessions.get(email);
  if(existing){await page.context().addCookies(existing.cookies);await page.goto(email.startsWith("admin")?"/admin/parcels":"/rider/assignments");return;}
  await page.goto("/login");
  await page.getByLabel("Login email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/\/(admin\/parcels|rider\/assignments|setup)/);
  sessions.set(email,await page.context().storageState());
}
async function expectCustomerOnly(page:Page){
  await expect(page.locator('a[href^="/admin"],a[href^="/rider"],a[href="/login"]')).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Sign out"})).toHaveCount(0);
}
async function expectRiderOnly(page:Page){
  await expect(page.locator('a[href^="/admin"],a[href^="/track"],a[href="/login"]')).toHaveCount(0);
  const navigation=page.getByRole("navigation",{name:"Rider navigation"});
  await expect(navigation.getByRole("link",{name:"My Deliveries",exact:true})).toBeVisible();
  await expect(navigation.getByRole("link",{name:/^Notifications/})).toBeVisible();
  await expect(navigation.getByRole("link")).toHaveCount(2);
}

test("Customer entry only exposes parcel tracking",async({page})=>{
  await page.setViewportSize({width:360,height:800});
  await page.goto("/");await expect(page).toHaveURL(/\/track$/);
  await expectCustomerOnly(page);
  await expect(page.getByRole("heading",{name:"Track your parcel"})).toBeVisible();
  await page.getByLabel("Parcel code").fill(`INVALID-${randomUUID()}`);
  await page.getByRole("button",{name:"Track",exact:true}).click();
  await expect(page.getByText("Parcel code is invalid or unavailable.")).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test("Admin, customer and Rider complete a durable delivery", async ({
  browser,
}) => {
  test.skip(
    !process.env.SEED_PASSWORD,
    "Requires a migrated and seeded local PostgreSQL database.",
  );
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await login(admin, "admin@parcel.test");
  await expect(admin).toHaveURL(/admin\/parcels/);
  const adminNavigation = admin.getByRole("navigation", { name: "Admin navigation" });
  await expect(adminNavigation.getByRole("link")).toHaveCount(3);
  await expect(adminNavigation.locator('a[href^="/track"],a[href^="/rider"],a[href="/login"]')).toHaveCount(0);
  await admin.goto("/admin/riders/new");
  await admin
    .getByLabel("Rider Name", { exact: true })
    .fill("Browser fixture Rider");
  await admin.getByLabel("Contact Number", { exact: true }).fill("09970000333");
  await admin.getByLabel("Vehicle Type").selectOption("BICYCLE");
  await admin
    .getByLabel("Login email")
    .fill(`browser-${randomUUID()}@parcel.test`);
  await admin.getByRole("button", { name: "Save", exact: true }).click();
  await expect(admin.getByText(/One-time setup password/)).toBeVisible();
  await admin.goto("/admin/parcels/new");
  for (const [name, value] of [
    ["Business/Person Name", "Browser sender"],
    ["Received Person", "Browser operator"],
    ["Customer Name", "Browser recipient"],
    ["Contact Number", "09970000444"],
    ["Order Amount (required for COD)", "25000.00"],
    ["Delivery Fee", "2000.00"],
    ["Township", "Sanchaung"],
    ["Address", "Synthetic browser-test address"],
  ])
    await admin.getByLabel(name, { exact: true }).fill(value);
  const today = businessToday();
  await admin.getByLabel("Received Date").fill(today);
  await admin.getByLabel("Payment Type").selectOption("COD");
  await admin.getByRole("button", { name: "Save", exact: true }).click();
  await expect(admin).toHaveURL(/admin\/parcels\/[a-f0-9-]+$/);
  await expect(admin.locator("code")).toBeVisible();
  const code = (await admin.locator("code").textContent())!;
  await admin
    .getByRole("link", { name: "Manage assignment", exact: true })
    .click();
  await admin
    .getByLabel("Rider", { exact: true })
    .selectOption({ label: "Aung Min" });
  await admin.getByLabel("Assign Date").fill(today);
  await admin.getByLabel("Delivery Date", { exact: true }).fill(today);
  await admin.getByRole("button", { name: "Save", exact: true }).click();
  await expect(admin).toHaveURL(/admin\/assignments\/[a-f0-9-]+$/);
  const assignmentId = admin.url().split("/").at(-1)!;
  const customerContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const customer = await customerContext.newPage();
  await customer.goto("/track");
  await expectCustomerOnly(customer);
  await customer.getByLabel("Parcel code").fill(code);
  await customer.getByRole("button", { name: "Track", exact: true }).click();
  await expect(customer).toHaveURL(/track\/result/);
  await expect(customer.getByText("On the Way", { exact: true })).toBeVisible();
  await expectCustomerOnly(customer);
  await customer.getByLabel("Receiving place").selectOption("NEIGHBOUR");
  await customer
    .getByLabel("Delivery instructions")
    .fill("Leave with neighbour at number 4.");
  await customer.getByRole("button", { name: "Save", exact: true }).click();
  await expect(customer.getByText("Saved successfully.")).toBeVisible();
  const riderContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const rider = await riderContext.newPage();
  await login(rider, "rider1@parcel.test");
  await expect(rider).toHaveURL(/rider\/assignments/);
  await expectRiderOnly(rider);
  await expect(rider.getByRole("heading",{name:"My Deliveries",exact:true})).toBeVisible();
  await rider.getByLabel("Parcel Code",{exact:true}).fill(code);
  await rider.getByRole("button",{name:"Search",exact:true}).click();
  await expect(rider.locator("tbody tr")).toHaveCount(1);
  await expect(rider.getByRole("link",{name:code,exact:true})).toBeVisible();
  const nextDate=new Date(`${today}T00:00:00Z`);nextDate.setUTCDate(nextDate.getUTCDate()+1);
  await rider.getByLabel("Delivery Date",{exact:true}).fill(nextDate.toISOString().slice(0,10));
  await rider.getByRole("button",{name:"Search",exact:true}).click();
  await expect(rider.getByText("No matching records.")).toBeVisible();
  await rider.getByLabel("Delivery Date",{exact:true}).fill(today);
  await rider.getByRole("button",{name:"Search",exact:true}).click();
  await expect(rider.locator("tbody tr")).toHaveCount(1);
  await rider.getByRole("link",{name:/^Notifications/}).click();
  await expectRiderOnly(rider);
  await rider.getByLabel("Parcel Code",{exact:true}).fill(code);
  await rider.getByLabel("Delivery Date",{exact:true}).fill(today);
  await rider.getByRole("button",{name:"Search",exact:true}).click();
  await expect(
    rider
      .getByText("Leave with neighbour at number 4.", { exact: false })
      .first(),
  ).toBeVisible();
  const notice=rider.locator("article").filter({hasText:`Browser recipient changed receiving option for ${code}.`});
  await expect(notice).toBeVisible();
  await notice.getByRole("button",{name:"Mark read",exact:true}).click();
  await expect(notice.getByRole("button",{name:"Mark read",exact:true})).toHaveCount(0);
  await rider.goto(`/rider/assignments/${assignmentId}`);
  await expectRiderOnly(rider);
  await riderContext.grantPermissions(["clipboard-read","clipboard-write"]);
  await rider.getByRole("button",{name:"Copy",exact:true}).click();
  await expect(rider.getByText("Copied",{exact:true})).toBeVisible();
  await expect(
    rider.getByText("Instructions: Leave with neighbour at number 4."),
  ).toBeVisible();
  await rider
    .getByLabel("Delivery result")
    .selectOption("CUSTOMER_UNREACHABLE");
  await rider.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(rider.getByText("Saved successfully.")).toBeVisible();
  await customer.reload();
  await expect(customer.getByText("Delay", { exact: true })).toBeVisible();
  await rider.reload();
  await rider
    .getByLabel("Delivery result")
    .selectOption("DELIVERED_TO_NEIGHBOUR");
  const photo = await sharp({
    create: { width: 64, height: 64, channels: 3, background: "#487ac4" },
  })
    .png()
    .toBuffer();
  await rider
    .getByLabel(/Delivery photo/)
    .setInputFiles({ name: "proof.png", mimeType: "image/png", buffer: photo });
  await rider.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(
    rider.getByRole("link", { name: "View private photo" }).first(),
  ).toBeVisible();
  await customer.reload();
  await expect(customer.getByText("Delivered", { exact: true })).toBeVisible();
  await expect(customer.getByLabel("Receiving place")).toHaveCount(0);
  await admin.reload();
  await expect(
    admin.getByRole("link", { name: "View private photo" }).first(),
  ).toBeVisible();
  const href = await admin
    .getByRole("link", { name: "View private photo" })
    .first()
    .getAttribute("href");
  expect((await adminContext.request.get(href!)).status()).toBe(200);
  expect((await customerContext.request.get(href!)).status()).toBe(401);
  expect(
    await customer.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await adminContext.close();
  await riderContext.close();
  await customerContext.close();
});

test("Reassignment revokes old Rider proof access and tracking scopes remain isolated",async({browser})=>{
  test.skip(!process.env.SEED_PASSWORD,"Requires seeded local PostgreSQL and private storage.");
  const origin=process.env.APP_BASE_URL??"http://localhost:3000";
  const adminContext=await browser.newContext();const admin=await adminContext.newPage();
  await login(admin,"admin@parcel.test");await expect(admin).toHaveURL(/admin\/parcels/);
  const input={senderName:"Browser isolation sender",receivedDate:businessToday(),receivedPerson:"Browser operator",customerName:"Synthetic isolation recipient",customerContactNumber:"09970000555",township:"Synthetic township",address:"Synthetic browser address",paymentType:"PREPAID",orderAmount:null,deliveryFee:"1.00"};
  async function createParcel(){const response=await adminContext.request.post("/api/v1/admin/parcels",{headers:{Origin:origin,"Idempotency-Key":randomUUID()},data:input});expect(response.status()).toBe(200);const id=(await response.json()).data.id;return (await (await adminContext.request.get(`/api/v1/admin/parcels/${id}`)).json()).data;}
  const p=await createParcel(),second=await createParcel();
  const profiles=await (await adminContext.request.get("/api/v1/admin/riders?name=Aung%20Min")).json();const riderId=profiles.data[0].id;
  const assignment=await adminContext.request.post("/api/v1/admin/assignments",{headers:{Origin:origin,"Idempotency-Key":randomUUID()},data:{parcelId:p.id,riderId,assignDate:businessToday(),deliveryDate:businessToday(),version:p.version,mode:"assign"}});expect(assignment.status()).toBe(200);const aid=(await assignment.json()).data.id;
  const oldContext=await browser.newContext();const old=await oldContext.newPage();await login(old,"rider1@parcel.test");await expect(old).toHaveURL(/rider\/assignments/);
  const before=(await (await oldContext.request.get(`/api/v1/rider/assignments/${aid}`)).json()).data;
  const photo=await sharp({create:{width:16,height:16,channels:3,background:"#487ac4"}}).png().toBuffer();
  const attempt=await oldContext.request.post(`/api/v1/rider/assignments/${aid}/results`,{headers:{Origin:origin},multipart:{result:"CUSTOMER_UNREACHABLE",version:String(before.parcel.version),idempotencyKey:randomUUID(),photo:{name:"attempt.png",mimeType:"image/png",buffer:photo}}});expect(attempt.status()).toBe(200);
  const withProof=(await (await oldContext.request.get(`/api/v1/rider/assignments/${aid}`)).json()).data;const proofUrl=`/api/v1/photos/${withProof.attempts[0].photoAssetId}`;expect((await oldContext.request.get(proofUrl)).status()).toBe(200);
  const customer1=await browser.newContext(),customer2=await browser.newContext();
  for(const [context,code] of [[customer1,p.parcelCode],[customer2,second.parcelCode]] as const)expect((await context.request.post("/api/v1/tracking/exchange",{headers:{Origin:origin},data:{code}})).status()).toBe(200);
  const firstView=(await (await customer1.request.get("/api/v1/tracking")).json()).data;
  const secondView=(await (await customer2.request.get("/api/v1/tracking")).json()).data;
  expect((await customer2.request.post("/api/v1/tracking/preferences",{headers:{Origin:origin},data:{parcelId:p.id,version:secondView.version,receivingOption:"DOOR",deliveryInstruction:"Wrong scope"}})).status()).toBe(422);
  expect((await customer2.request.post("/api/v1/tracking/preferences",{headers:{Origin:origin},data:{version:secondView.version,receivingOption:"DOOR",deliveryInstruction:"Second parcel only"}})).status()).toBe(200);
  expect((await (await customer1.request.get("/api/v1/tracking")).json()).data).toEqual(firstView);
  await admin.goto(`/admin/assignments/new?parcel=${p.id}`);await admin.getByLabel("Action",{exact:true}).selectOption("reassign");await admin.getByLabel("Find Rider by name").fill("Thiri Aye");await admin.getByLabel("Rider",{exact:true}).selectOption({label:"Thiri Aye"});await admin.getByLabel("Assign Date").fill(businessToday());await admin.getByLabel("Delivery Date",{exact:true}).fill(businessToday());await admin.getByRole("button",{name:"Save",exact:true}).click();await expect(admin).toHaveURL(/admin\/assignments\/[a-f0-9-]+$/);
  const newAid=admin.url().split("/").at(-1)!;
  await old.goto(`/rider/assignments/${aid}`);await expect(old.getByText("Assignment unavailable.")).toBeVisible();expect((await oldContext.request.get(proofUrl)).status()).toBe(404);
  const unauthorized=await oldContext.request.post(`/api/v1/rider/assignments/${aid}/results`,{headers:{Origin:origin},multipart:{result:"CUSTOMER_UNREACHABLE",version:String(withProof.parcel.version),idempotencyKey:randomUUID()}});expect(unauthorized.status()).toBe(404);
  const newContext=await browser.newContext();const current=await newContext.newPage();await login(current,"rider2@parcel.test");await expect(current).toHaveURL(/rider\/assignments/);await current.goto(`/rider/assignments/${newAid}`);await expect(current.getByRole("heading",{name:new RegExp(p.parcelCode)})).toBeVisible();
  expect((await newContext.request.get(`/api/v1/rider/assignments/${aid}`)).status()).toBe(404);expect((await adminContext.request.get(proofUrl)).status()).toBe(200);
  await Promise.all([adminContext,oldContext,newContext,customer1,customer2].map(c=>c.close()));
});

test("An Admin session cannot turn the Rider URL into an Admin workspace",async({browser})=>{
  test.skip(!process.env.SEED_PASSWORD,"Requires seeded local accounts.");
  const context=await browser.newContext();const page=await context.newPage();
  await login(page,"admin@parcel.test");await page.goto("/rider/assignments");
  await expect(page).toHaveURL(/\/rider\/assignments$/);
  await expect(page.getByRole("heading",{name:"Rider account required"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Sign in as a Rider"})).toBeVisible();
  await expect(page.locator('a[href^="/admin"],a[href^="/track"]')).toHaveCount(0);
  await expect(page.getByRole("table")).toHaveCount(0);
  await context.close();
});
