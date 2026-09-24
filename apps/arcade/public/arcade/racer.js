(() => {
'use strict';
const $=id=>document.getElementById(id),canvas=$('road'),ctx=canvas.getContext('2d'),W=800,H=680,roadLeft=235,roadRight=565,playerY=590;
const held=new Set();let state='ready',distance=0,best=0,lives=3,protect=0,elapsed=0,spawn=2,traffic=[],player=0,speed=0;
canvas.height=H;
let skid=0;
let sound=true,audio=null,engine=null,gain=null;
try{best=Number(localStorage.getItem('coastal-best'))||0;sound=localStorage.getItem('coastal-sound')!=='false';}catch(_){}
function audioStart(){if(!sound)return;try{const A=window.AudioContext||window.webkitAudioContext;if(!audio&&A){audio=new A();engine=audio.createOscillator();gain=audio.createGain();engine.type='triangle';engine.connect(gain);gain.connect(audio.destination);gain.gain.value=0;engine.start();}if(audio?.state==='suspended')audio.resume().catch(()=>{});}catch(_){}}
function audioUpdate(){if(!audio)return;engine.frequency.setTargetAtTime(45+speed*.5,audio.currentTime,.1);gain.gain.setTargetAtTime(sound&&state==='playing'?.022:0,audio.currentTime,.05);}
function crashSound(){if(!sound||!audio)return;const o=audio.createOscillator(),g=audio.createGain();o.type='sawtooth';o.frequency.setValueAtTime(100,audio.currentTime);o.frequency.exponentialRampToValueAtTime(25,audio.currentTime+.25);g.gain.setValueAtTime(.07,audio.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+.25);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+.26);o.onended=()=>{o.disconnect();g.disconnect();};}
// A contact cooldown prevents a sustained shove from firing audio every frame.
function pushSound(spin=false){
 if(!sound||!audio||audio.state!=='running')return;
 const now=audio.currentTime,duration=spin?.32:.13;
 const o=audio.createOscillator(),g=audio.createGain();
 o.type=spin?'sawtooth':'triangle';
 o.frequency.setValueAtTime(spin?620:190,now);
 o.frequency.exponentialRampToValueAtTime(spin?140:48,now+duration);
 g.gain.setValueAtTime(.0001,now);g.gain.linearRampToValueAtTime(spin?.065:.09,now+.006);
 g.gain.exponentialRampToValueAtTime(.0001,now+duration);
 o.connect(g);g.connect(audio.destination);o.start(now);o.stop(now+duration+.01);
 o.onended=()=>{o.disconnect();g.disconnect();};
}
function hud(){ $('distance').textContent=`${Math.floor(distance)} m`;$('best').textContent=`${Math.floor(best)} m`;$('health').textContent=Array.from({length:3},(_,i)=>i<lives?'♥':'♡').join(' ');$('speed').textContent=Math.round(speed);$('throttle').value=speed;$('drive-state').textContent=held.has('brake')?'BRAKING':held.has('up')?'ACCELERATING':held.has('down')?'DECELERATING':speed===0?'STOPPED':'CRUISING';}
function show(title,text){$('title').textContent=title;$('description').textContent=text;$('start').textContent=state==='paused'?'KEEP CRUISING →':'DRIVE AGAIN →';$('badge').textContent=state==='paused'?'PARKED FOR A MOMENT':'END OF THE ROAD';$('overlay').hidden=false;$('announce').textContent=title+' '+text;}
function start(){audioStart();if(state!=='paused'){distance=0;lives=3;protect=0;elapsed=0;spawn=2;traffic=[];player=0;speed=0;skid=0;}state='playing';held.clear();$('overlay').hidden=true;$('pause').disabled=false;$('pause').textContent='PAUSE · P';canvas.focus({preventScroll:true});hud();audioUpdate();}
function pause(){if(state==='paused')return start();if(state!=='playing')return;state='paused';held.clear();audioUpdate();$('pause').textContent='RESUME · P';show('Enjoy the view.','Your drive is paused. Press P or Resume to continue.');}
function damage(){if(protect>0)return;lives--;protect=2;speed=0;skid=0;held.clear();player=0;traffic=[];spawn=2;crashSound();$('announce').textContent='Collision. One life lost. Accelerate to rejoin the road.';if(!lives){state='over';held.clear();$('pause').disabled=true;if(distance>best){best=distance;try{localStorage.setItem('coastal-best',String(best));}catch(_){}}show('What a detour.',`You drove ${Math.floor(distance)} metres. Ready to take the coast again?`);audioUpdate();}hud();}
function update(dt){
 if(state!=='playing')return;
 elapsed+=dt;protect=Math.max(0,protect-dt);skid=Math.max(0,skid-dt);
 // Speed is directly controlled and remains set when pedals are released.
 if(held.has('brake'))speed-=220*dt;
 else if(held.has('down'))speed-=85*dt;
 else if(held.has('up'))speed+=70*dt;
 speed=Math.max(0,Math.min(300,speed));
 distance+=speed/3.6*dt;
 const steer=(held.has('right')?1:0)-(held.has('left')?1:0);
 player+=steer*(skid>0?1.2:2.3)*Math.min(1,speed/35)*dt;
 if(skid>0)player+=Math.sin(elapsed*17)*.28*dt;
 player=Math.max(-1,Math.min(1,player));
 if(Math.abs(player)>.95){damage();player=Math.max(-.89,Math.min(.89,player));return;}
 spawn-=dt*speed/180;
 if(spawn<=0){
   const roll=Math.random(),type=roll<.52?'car':roll<.7?'barrier':roll<.86?'cone':'oil';
   const lane=[-.67,0,.67][Math.floor(Math.random()*3)];
   traffic.push({lane,y:-85,type,vx:0,angle:0,spin:0,w:type==='barrier'?65:type==='cone'?26:26,h:type==='car'?44:type==='cone'?38:36,color:['#ffd066','#60c5cf','#a3a7e8','#e7e6cf'][Math.floor(Math.random()*4)]});
   // One object per row, with enough approach time to change lanes.
   spawn=.95+Math.random()*.5;
 }
 for(const item of traffic){
   item.y+=dt*speed*(item.type==='car'?1.6:2.5);
   if(item.type==='car'){
     item.lane+=item.vx*dt/145;item.vx*=Math.exp(-1.2*dt);
     item.angle+=item.spin*dt;
     if(Math.abs(item.lane)>1.16){item.offroad=true;item.hit=true;item.y+=dt*90;}
   }
   const dx=(item.lane-player)*145,dy=item.y-playerY;
   if(!item.hit&&Math.abs(dx)<(item.w+26)/2-2&&Math.abs(dy)<(item.h+44)/2-3){
     if(item.type==='car'&&Math.abs(dx)>12&&speed>15){
       const side=Math.sign(dx)||1;
       item.lane=player+side*((item.w+26)/2+1)/145;
       item.vx=side*(85+speed*.3);
       if(elapsed >= (item.nextPushSound || 0)){
         pushSound(dy < -9);item.nextPushSound=elapsed+.22;
       }
       // Player nose contacting the other car's rear quarter starts a spin.
       if(dy < -9){item.spin=side*4.5;item.hit=true;$('announce').textContent='Rear corner hit — traffic spinning out!';}
       else{$('announce').textContent='Side swipe — traffic pushed aside.';}
     }else{
       item.hit=true;
       if(item.type==='oil'){skid=1.3;$('announce').textContent='Oil slick! Grip reduced briefly.';}
       else{damage();return;}
     }
   }
 }
 traffic=traffic.filter(item=>item.y<H+100);hud();audioUpdate();
}
function poly(points,color){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=color;ctx.fill();}
function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),w,h);}
function car(x,y,color,hero=false){
 ctx.save();ctx.translate(x,y);ctx.scale(.56,.56);
 if(hero)ctx.rotate(skid>0?Math.sin(elapsed*17)*.1:((held.has('right')?1:0)-(held.has('left')?1:0))*.045);
 ctx.fillStyle='#0d172955';ctx.beginPath();ctx.ellipse(3,5,27,42,0,0,Math.PI*2);ctx.fill();
 for(const yy of [-25,18]){rect(-25,yy,7,15,'#121821');rect(18,yy,7,15,'#121821');rect(-25,yy+2,2,11,'#566773');rect(23,yy+2,2,11,'#566773');}
 const body=ctx.createLinearGradient(-24,0,24,0);body.addColorStop(0,'#273b49');body.addColorStop(.15,color);body.addColorStop(.4,color);body.addColorStop(.5,'#ffffffb0');body.addColorStop(.6,color);body.addColorStop(.85,color);body.addColorStop(1,'#263845');
 poly([[-15,-39],[15,-39],[21,-30],[23,-12],[21,30],[16,39],[-16,39],[-21,30],[-23,-12],[-21,-30]],body);
 poly([[-15,-18],[15,-18],[18,-5],[-18,-5]],'#173849');poly([[-13,-17],[12,-17],[7,-13],[-15,-10]],'#a0d5e6');
 poly([[-15,19],[15,19],[17,29],[-17,29]],'#214357');rect(-12,20,24,2,'#8dafbf');
 poly([[-19,-1],[-15,2],[-15,16],[-19,20]],'#244453');poly([[19,-1],[15,2],[15,16],[19,20]],'#244453');
 rect(-12,-1,24,18,color);rect(-11,0,22,2,'#ffffff55');
 ctx.strokeStyle='#233d4755';ctx.lineWidth=1;for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(side*11,-33);ctx.lineTo(side*14,-23);ctx.stroke();rect(side<0?-27:21,-8,6,4,color);}
 rect(-18,-34,10,4,'#fff7c5');rect(8,-34,10,4,'#fff7c5');rect(-9,-39,18,2,'#283b49');
 const brake=hero&&(held.has('brake')||held.has('down'));
 ctx.shadowColor='#ff3636';ctx.shadowBlur=brake?13:0;rect(-17,33,10,4,brake?'#ff413b':'#a93637');rect(7,33,10,4,brake?'#ff413b':'#a93637');ctx.shadowBlur=0;
 rect(-8,35,16,5,'#e3e5db');ctx.fillStyle='#23333b';ctx.font='4px monospace';ctx.textAlign='center';ctx.fillText('404',0,39);
 rect(-18,40,36,3,'#223039');rect(-14,40,4,4,'#a2b1bb');rect(10,40,4,4,'#a2b1bb');
 ctx.restore();
}
function palm(x,y){rect(x+3,y+4,6,19,'#474b3760');rect(x-3,y-2,6,20,'#92683f');for(let i=0;i<7;i++){const a=i*Math.PI*2/7;poly([[x,y],[x+Math.cos(a)*29,y+Math.sin(a)*25],[x+Math.cos(a+.45)*15,y+Math.sin(a+.45)*13]],i%2?'#45845b':'#285a43');}rect(x-3,y-3,6,6,'#a7ad65');}
function obstacle(item){const x=400+item.lane*145,y=item.y;
 if(item.type==='car'){ctx.save();ctx.translate(x,y);ctx.rotate(item.angle||0);car(0,0,item.color);ctx.restore();return;}
 if(item.type==='barrier'){
 rect(x-39,y+8,8,16,'#212a35');rect(x+31,y+8,8,16,'#212a35');rect(x-40,y-16,80,29,'#f6d68d');
 for(let i=0;i<5;i++)poly([[x-40+i*16,y-16],[x-32+i*16,y-16],[x-40+i*16,y+13],[x-48+i*16,y+13]],'#e76e46');
 rect(x-40,y-17,80,3,'#fff0be');
 }else if(item.type==='cone'){
 rect(x-16,y+10,32,7,'#26313a');poly([[x,y-19],[x+13,y+12],[x-13,y+12]],'#ff9552');poly([[x-5,y-6],[x+5,y-6],[x+8,y+1],[x-8,y+1]],'#ffefcc');
 }else{
 ctx.fillStyle='#151c29';ctx.beginPath();ctx.ellipse(x,y,24,15,-.2,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#8778aa';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x-3,y-2,14,6,-.2,0,Math.PI);ctx.stroke();
 }
}
function draw(){
 ctx.imageSmoothingEnabled=true;
 const scroll=distance*9;
 rect(0,0,W,H,'#cfbc87');rect(0,0,122,H,'#398b9d');rect(122,0,22,H,'#71b7b2');rect(144,0,16,H,'#cde1bd');
 for(let i=0;i<20;i++){const y=(i*39+scroll*.4)%560-30;rect((i*31)%90,y,25,3,'#9ed8ca');}
 rect(644,0,156,H,'#659365');
 for(let i=0;i<11;i++){const y=(i*77+scroll)%770-100;palm(173,y);palm(677,y+30);}
 for(let i=0;i<5;i++){const y=(i*175+scroll*.8)%875-170;rect(723,y,64,77,'#4e7757');rect(718,y-5,64,67,'#e6ce9d');rect(716,y-8,68,18,'#ad6d50');rect(727,y+21,14,14,'#466a71');rect(756,y+21,14,14,'#466a71');rect(745,y+44,13,18,'#8e7052');}
 rect(225,0,350,H,'#182935');rect(235,0,330,H,'#414d58');
 for(let i=0;i<34;i++){const y=(i*23+scroll)%730-25;rect(237+(i*37)%320,y,4,2,'#68727a40');}
 for(const x of [225,567])for(let i=-1;i<19;i++)rect(x,i*40+scroll%40,8,20,i%2?'#e9e2cc':'#df705a');
 rect(241,0,3,H,'#e8debd');rect(557,0,3,H,'#e8debd');
 for(const x of [345,455])for(let i=-1;i<12;i++)rect(x,i*72+scroll%72,4,35,'#e4e4cd');
 for(let i=0;i<10;i++){const y=(i*83+scroll)%830-80;rect(180,y,4,21,'#f0dfbb');rect(617,y,4,21,'#f0dfbb');}
 for(const item of traffic)obstacle(item);
 if(protect===0||Math.floor(protect*9)%2===0)car(400+player*145,playerY,'#f16c58',true);
 if(skid>0){ctx.fillStyle='#ffe0a0';ctx.font='bold 12px monospace';ctx.textAlign='center';ctx.fillText('OIL! LOW GRIP',400,H-20);}
}
const map={arrowleft:'left',a:'left',arrowright:'right',d:'right',arrowup:'up',w:'up',arrowdown:'down',s:'down',' ':'brake'};window.addEventListener('keydown',e=>{if(e.ctrlKey||e.altKey||e.metaKey||e.target.closest('button,a,input'))return;let k=e.key.toLowerCase();if(map[k]||k==='p'||k==='enter')e.preventDefault();if(k==='enter'&&!e.repeat&&state!=='playing')start();else if(k==='p'&&!e.repeat)pause();else if(map[k]&&state==='playing')held.add(map[k]);});window.addEventListener('keyup',e=>held.delete(map[e.key.toLowerCase()]));window.addEventListener('blur',()=>{held.clear();if(state==='playing')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')pause();});for(const b of document.querySelectorAll('[data-key]')){b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);if(state==='playing')held.add(b.dataset.key);});for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>held.delete(b.dataset.key));}$('start').addEventListener('click',start);$('pause').addEventListener('click',pause);function soundUI(){$('sound').textContent=sound?'SOUND ON':'SOUND OFF';$('sound').setAttribute('aria-pressed',String(sound));}$('sound').addEventListener('click',()=>{sound=!sound;try{localStorage.setItem('coastal-sound',String(sound));}catch(_){}audioStart();audioUpdate();soundUI();canvas.focus({preventScroll:true});});soundUI();hud();let last=null,acc=0;function frame(now){if(last===null)last=now;acc+=Math.min(now-last,100);last=now;while(acc>=1000/120){update(1/120);acc-=1000/120;}draw();requestAnimationFrame(frame);}requestAnimationFrame(frame);
})();
