import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID,createHash} from "node:crypto";
import sharp from "sharp";
import {getDb} from "../../src/lib/db";
import {getPrivateStore} from "../../src/lib/storage";
import {cleanupPhotos} from "../../src/server/services/photos";
if(process.env.NODE_ENV!=="development")throw new Error("Maintenance test requires development fixtures.");
const db=getDb(),store=getPrivateStore();
try {
  const assignment=await db.assignment.findFirstOrThrow({where:{parcel:{parcelCode:"SEED-2"}},include:{rider:true}});
  const bytes=await sharp({create:{width:8,height:8,channels:3,background:"#487ac4"}}).jpeg().toBuffer();
  const make=async(createdAt:Date)=>{const storageKey=`proof/${randomUUID()}.jpg`;await store.put(storageKey,bytes);return db.photoAsset.create({data:{storageKey,byteSize:bytes.length,checksum:createHash("sha256").update(bytes).digest("hex"),detectedMime:"image/jpeg",uploaderId:assignment.rider.userId!,parcelId:assignment.parcelId,assignmentId:assignment.id,createdAt}});};
  const expired=await make(new Date(Date.now()-25*60*60*1000));const recent=await make(new Date());
  const attached=await db.photoAsset.findFirstOrThrow({where:{lifecycle:"ATTACHED",parcel:{parcelCode:"SEED-5"}}});
  const before=await store.get(attached.storageKey);
  assert(await cleanupPhotos()>=1);
  assert.equal(await db.photoAsset.findUnique({where:{id:expired.id}}),null);await assert.rejects(store.get(expired.storageKey));
  assert(await db.photoAsset.findUnique({where:{id:recent.id}}));assert.deepEqual(Buffer.from(await store.get(recent.storageKey)),bytes);
  assert.equal((await db.photoAsset.findUniqueOrThrow({where:{id:attached.id}})).lifecycle,"ATTACHED");assert.deepEqual(await store.get(attached.storageKey),before);
  await store.remove(recent.storageKey);await db.photoAsset.delete({where:{id:recent.id}});
  console.info("PASS staged-photo cleanup removes expired unattached data, preserves recent staging and retains attached evidence");
}finally{await db.$disconnect();}
