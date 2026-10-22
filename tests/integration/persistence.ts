import "dotenv/config";
import assert from "node:assert/strict";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {createHash} from "node:crypto";
import {getDb} from "../../src/lib/db";
import {getPrivateStore} from "../../src/lib/storage";
if(process.env.NODE_ENV!=="development")throw new Error("Restart verification is restricted to development fixtures.");
const db=getDb();
try {
  const snapshot={
    parcels:await db.parcel.findMany({select:{id:true,customerStatus:true,currentAssignmentId:true,version:true},orderBy:{id:"asc"}}),
    assignments:await db.assignment.findMany({select:{id:true,lifecycle:true,latestResult:true},orderBy:{id:"asc"}}),
    attempts:await db.deliveryAttempt.findMany({select:{id:true,result:true,photoAssetId:true},orderBy:{id:"asc"}}),
    notifications:await db.riderNotification.findMany({select:{id:true,readAt:true},orderBy:{id:"asc"}}),
    photos:await db.photoAsset.findMany({where:{lifecycle:"ATTACHED"},select:{id:true,storageKey:true,checksum:true},orderBy:{id:"asc"}}),
  };
  for(const photo of snapshot.photos){const bytes=await getPrivateStore().get(photo.storageKey);assert.equal(createHash("sha256").update(bytes).digest("hex"),photo.checksum);}
  const json=JSON.stringify(snapshot);
  if(process.argv.includes("--record")){await mkdir(".local",{recursive:true});await writeFile(".local/persistence-check.json",json);console.info("Recorded private restart baseline; proof bytes verified against database checksums.");}
  else {assert.equal(json,await readFile(".local/persistence-check.json","utf8"));console.info("PASS restart persistence: parcel states, assignment history, attempts, notifications and private proof bytes match the baseline.");}
}finally{await db.$disconnect();}
