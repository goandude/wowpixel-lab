export const avatars = ["pilot", "robot", "alien", "racer", "cat", "astronaut"] as const;
export function profileInput(body: Record<string, unknown>) {
 const handle=String(body.handle??"").trim();
 if(!/^[A-Za-z][A-Za-z0-9_]{2,19}$/.test(handle))throw new Error("Use 3–20 letters, numbers or underscores; start with a letter.");
 const avatar=String(body.avatar??"pilot");if(!avatars.includes(avatar as typeof avatars[number]))throw new Error("Choose a character.");
 const country=String(body.country??"").toUpperCase();if(country&&!/^[A-Z]{2}$/.test(country))throw new Error("Use a two-letter country code, or leave it blank.");
 return {handle,handleKey:handle.toLowerCase(),avatar,country,showCountry:body.showCountry===true};
}
export function racerResult(body: Record<string,unknown>,wallSeconds:number){
 const distance=body.distance,bonus=body.bonus,seconds=body.seconds;
 if(typeof distance!=="number"||typeof bonus!=="number"||typeof seconds!=="number"||![distance,bonus,seconds].every(Number.isFinite))throw new Error("Invalid result.");
 if(distance<0||bonus<0||seconds<1||seconds>14400||!Number.isInteger(bonus)||bonus%50!==0||seconds>wallSeconds+2||distance>seconds*300/3.6+10||bonus>seconds*2000+250)throw new Error("This result is outside the game limits.");
 return {distance:Math.floor(distance),bonus,seconds,score:Math.floor(distance)+bonus};
}
