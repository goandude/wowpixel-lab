import {cert,getApps,initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";
export function backend(){
 const {FIREBASE_CLIENT_EMAIL:clientEmail,FIREBASE_PRIVATE_KEY:privateKey}=process.env;
 if(!clientEmail||!privateKey)throw new Error("BACKEND_NOT_CONFIGURED");
 const app=getApps().find(a=>a.name==="arcade")??initializeApp({projectId:"arcade-9e532",credential:cert({projectId:"arcade-9e532",clientEmail,privateKey:privateKey.replace(/\\n/g,"\n")})},"arcade");
 return {db:getFirestore(app),auth:getAuth(app)};
}
