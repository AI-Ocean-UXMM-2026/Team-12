import { test, expect } from "@playwright/test";
test("starter navigation and sample Rider filtering", async ({page})=>{
  await page.goto("/");
  await expect(page.getByRole("heading", {name:"A foundation for every delivery"})).toBeVisible();
  await page.getByRole("navigation").getByRole("link", {name:"Riders",exact:true}).click();
  await expect(page.getByRole("row")).toHaveCount(6);
  await page.getByLabel("Rider Name").fill("Thiri");
  await expect(page.getByRole("row")).toHaveCount(2);
  await expect(page.getByRole("cell",{name:"Thiri Aye"})).toBeVisible();
  await page.getByRole("button",{name:"Reset"}).click();
  await expect(page.getByRole("row")).toHaveCount(6);
});
