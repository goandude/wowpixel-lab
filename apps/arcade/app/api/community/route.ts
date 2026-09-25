import {NextRequest,NextResponse} from "next/server";
import {randomUUID,createHash} from "node:crypto";
import {FieldValue} from "firebase-admin/firestore";
import {backend} from "../../../lib/firebase-server";
import {profileInput,racerResult} from "../../../lib/community-validation";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}});
async function identity(req:NextRequest){const header=req.headers.get("authorization");if(!header)return null;try{const token=await backend().auth.verifyIdToken(header.replace(/^Bearer /,""),true);if(token.firebase.sign_in_provider!=="google.com")throw Error();return token.uid;}catch{throw new Error("UNAUTHORIZED");}}
function failure(e:unknown){const msg=e instanceof Error?e.message:"";if(msg==="UNAUTHORIZED")return reply({error:"Please sign in with Google again."},401);if(msg==="BACKEND_NOT_CONFIGURED")return reply({error:"Community features are awaiting server setup. Guest play is available."},503);if(msg.startsWith("USER:"))return reply({error:msg.slice(5)},400);console.error("Arcade community request failed",e instanceof Error?e.name:"Error");return reply({error:"Community service unavailable. Please try again later."},503);}
const userError=(text:string):never=>{throw new Error("USER:"+text);};
export async function GET(req:NextRequest){try{
 const {db}=backend(),view=req.nextUrl.searchParams.get("view")??"public";
 if(view==="me"){
 const uid=await identity(req);if(!uid)throw new Error("UNAUTHORIZED");
 const [profile,history,like]=await Promise.all([db.doc(`players/${uid}`).get(),db.collection(`players/${uid}/history`).orderBy("endedAt","desc").limit(20).get(),db.doc(`games/racer/likes/${uid}`).get()]);
 return reply({profile:profile.data()??null,history:history.docs.map(d=>d.data()),liked:like.exists,country:process.env.VERCEL?req.headers.get("x-vercel-ip-country")??"":""});
 }
 const [stats,leaders]=await Promise.all([db.doc("games/racer").get(),db.collection("games/racer/bests").orderBy("score","desc").limit(10).get()]);
 const rows=await Promise.all(leaders.docs.map(async d=>{const profile=(await db.doc(`players/${d.id}`).get()).data();return profile?{handle:profile.handle,avatar:profile.avatar,country:profile.showCountry?profile.country:"",score:d.data().score}:null;}));
 return reply({plays:stats.data()?.plays??0,likes:stats.data()?.likes??0,uniquePlayers:stats.data()?.uniquePlayers??0,leaderboard:rows.filter(Boolean)});
 }catch(e){return failure(e);}}
export async function POST(req:NextRequest){try{
 const origin=req.headers.get("origin");if(!origin||new URL(origin).host!==req.headers.get("host"))return reply({error:"Same-origin requests only."},403);
 const raw=await req.text();if(raw.length>8192)return reply({error:"Request too large."},413);
 let body;try{body=JSON.parse(raw);}catch{return reply({error:"Invalid request."},400);}
 if(!body||typeof body!=="object"||Array.isArray(body))return reply({error:"Invalid request."},400);
 const {db}=backend(),uid=await identity(req),now=Date.now();
 const cookie=req.cookies.get("arcade-player")?.value;const guest=cookie&&/^[a-f0-9-]{36}$/.test(cookie)?cookie:randomUUID();
 const actor=createHash("sha256").update(uid?"user:"+uid:"guest:"+guest).digest("hex");
 const player=uid?db.doc(`players/${uid}`):null,game=db.doc("games/racer");
 if(body.action==="start"){
 const runId=String(body.runId??"");if(!/^[a-f0-9-]{36}$/.test(runId))return reply({error:"Invalid run."},400);
 const run=db.doc(`runs/${runId}`),visitor=db.doc(`games/racer/visitors/${actor}`);
 await db.runTransaction(async tx=>{const [existing,v]=await Promise.all([tx.get(run),tx.get(visitor)]);if(existing.exists){if(existing.data()?.actor!==actor)userError("Run unavailable.");return;}if(now-(v.data()?.lastStart??0)<10000)userError("Wait a few seconds before starting another recorded run.");tx.set(run,{uid,actor,game:"racer",startedAt:now,finished:false,expiresAt:new Date(now+86400000)});tx.set(visitor,{lastStart:now},{merge:true});tx.set(game,{plays:FieldValue.increment(1),uniquePlayers:FieldValue.increment(v.exists?0:1)},{merge:true});});
 const result=reply({runId,ranked:!!uid});result.cookies.set("arcade-player",guest,{httpOnly:true,sameSite:"strict",secure:process.env.NODE_ENV==="production",maxAge:31536000,path:"/"});return result;
 }
 if(!uid||!player)throw new Error("UNAUTHORIZED");
 if(body.action==="profile"){
 let profile;try{profile=profileInput(body);}catch(e){userError((e as Error).message);}
 const value=profile!,handle=db.doc(`handles/${value.handleKey}`);
 await db.runTransaction(async tx=>{const [old,taken]=await Promise.all([tx.get(player),tx.get(handle)]);if(taken.exists&&taken.data()?.uid!==uid)userError("That handle is already taken.");if(now-(old.data()?.updatedAt??0)<2000)userError("Please wait before updating again.");if(old.data()?.handleKey&&old.data()?.handleKey!==value.handleKey)tx.delete(db.doc(`handles/${old.data()!.handleKey}`));tx.set(handle,{uid});tx.set(player,{...value,updatedAt:now,createdAt:old.data()?.createdAt??now});});return reply({ok:true});
 }
 if(body.action==="like"){
 if(typeof body.liked!=="boolean")return reply({error:"Invalid like."},400);
 const like=db.doc(`games/racer/likes/${uid}`),limit=db.doc(`players/${uid}/limits/like`);
 await db.runTransaction(async tx=>{const [old,rate]=await Promise.all([tx.get(like),tx.get(limit)]);if(old.exists===body.liked)return;if(now-(rate.data()?.at??0)<1000)userError("Please wait a moment.");tx.set(limit,{at:now});if(body.liked)tx.set(like,{at:now});else tx.delete(like);tx.set(game,{likes:FieldValue.increment(body.liked?1:-1)},{merge:true});});return reply({ok:true});
 }
 if(body.action==="finish"){
 const id=String(body.runId??"");if(!/^[a-f0-9-]{36}$/.test(id))return reply({error:"Invalid run."},400);
 const run=db.doc(`runs/${id}`),best=db.doc(`games/racer/bests/${uid}`);let score=0;
 await db.runTransaction(async tx=>{const [r,p,b]=await Promise.all([tx.get(run),tx.get(player),tx.get(best)]);if(!r.exists||r.data()?.uid!==uid||r.data()?.game!=="racer")userError("Start a new run after signing in.");if(r.data()?.finished){score=r.data()?.score;return;}if(!p.exists)userError("Save your profile before submitting scores.");if(now-r.data()!.startedAt>86400000)userError("Run expired.");let result;try{result=racerResult(body,(now-r.data()!.startedAt)/1000);}catch(e){userError((e as Error).message);}score=result!.score;tx.update(run,{finished:true,score});tx.set(db.doc(`players/${uid}/history/${id}`),{...result,game:"racer",endedAt:now});if(!b.exists||score>b.data()!.score)tx.set(best,{score,endedAt:now});});return reply({ok:true,score});
 }
 return reply({error:"Unknown action."},400);
 }catch(e){return failure(e);}}
