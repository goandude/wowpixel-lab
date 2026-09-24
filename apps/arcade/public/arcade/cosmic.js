// Cosmic Courier artwork: drawn locally so the game stays playable offline.
window.drawCosmicCourier = (ctx, bird, pipes, clock, W, H) => {
  const poly = (points, color, stroke) => {
    ctx.beginPath(); points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
    ctx.fillStyle=color;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}
  };
  const ellipse = (x,y,rx,ry,color) => {ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();};
  const sky=ctx.createLinearGradient(0,0,W,H);sky.addColorStop(0,'#070e25');sky.addColorStop(.6,'#162043');sky.addColorStop(1,'#23213e');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
  for(let i=0;i<110;i++){const z=i%3;const x=((i*173.7-clock*(3+z*6))%W+W)%W;const y=(i*79.3)%H;ctx.fillStyle=['#a5bce54a','#c6dcff90','#f1ebd8c0'][z];ctx.fillRect(x,y,z===2?1.7:1,1.4);}
  // A blue planet drifts behind the obstacle field.
  ctx.save();ctx.translate(135-clock*1.5%50,495);ctx.rotate(-.35);
  const planet=ctx.createRadialGradient(-100,-150,10,0,0,285);planet.addColorStop(0,'#a6dcf0');planet.addColorStop(.45,'#538bba');planet.addColorStop(.8,'#244570');planet.addColorStop(1,'#12253f');
  ellipse(0,0,285,285,planet);ctx.save();ctx.beginPath();ctx.arc(0,0,283,0,Math.PI*2);ctx.clip();
  for(let i=0;i<16;i++){ctx.strokeStyle=i%2?'#d3ecf24a':'#122d5555';ctx.lineWidth=5+i%4;ctx.beginPath();ctx.ellipse(-30+i*7,-250+i*33,270,18,0,0,Math.PI*2);ctx.stroke();}ctx.restore();
  ctx.strokeStyle='#97d7ef80';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,287,0,Math.PI*2);ctx.stroke();ctx.restore();
  ctx.save();ctx.translate(593-clock*2%40,94);ctx.rotate(-.35);ctx.strokeStyle='#a2aad650';ctx.lineWidth=7;ctx.beginPath();ctx.ellipse(0,0,59,13,0,0,Math.PI*2);ctx.stroke();ellipse(0,0,28,28,'#555b91');ellipse(-8,-7,18,18,'#717cad');ctx.strokeStyle='#c2c5e050';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,0,59,13,0,0,Math.PI);ctx.stroke();ctx.restore();
  // Distant rock silhouettes establish depth without affecting collisions.
  for(let i=0;i<9;i++){let x=((i*111-clock*15)%(W+80)+W+80)%(W+80)-40;let y=40+(i*83)%350;poly([[x,y-10],[x+13,y-4],[x+10,y+12],[x-5,y+16],[x-14,y]],'#172338');}
  function rockColumn(x,y,height,seed){
    if(height<=0)return;
    ctx.save();ctx.beginPath();ctx.rect(x,y,52,height);ctx.clip();
    ctx.fillStyle='#74604f';ctx.fillRect(x,y,52,height);
    for(let row=0;row<height/25;row++)for(let col=0;col<3;col++){
      const xx=x+col*20-6+(row%2)*8,yy=y+row*25;
      const n=(row*7+col*13+seed)%5;
      poly([[xx+2,yy],[xx+19,yy+2],[xx+24,yy+15],[xx+13,yy+28],[xx-3,yy+18]],['#9c8266','#6b5b51','#806950','#b29777','#584e49'][n],'#443c38');
      poly([[xx+2,yy+2],[xx+15,yy+4],[xx+7,yy+10],[xx-1,yy+15]],'#b49a7750');
    }
    ctx.fillStyle='#0d14284a';ctx.fillRect(x+38,y,14,height);
    // Blue crystals embedded into the rock, contained inside the collision edge.
    for(let i=0;i<Math.ceil(height/85);i++){
      const xx=x+18+(i%2)*10,yy=y+22+i*79;
      ctx.shadowColor='#62cfff';ctx.shadowBlur=9;
      poly([[xx,yy-15],[xx+9,yy-2],[xx+5,yy+23],[xx-5,yy+11]],'#59c4ed','#b9eaff');ctx.shadowBlur=0;
      poly([[xx,yy-15],[xx+1,yy+6],[xx-5,yy+11]],'#d3f8ff');
      poly([[xx+1,yy+6],[xx+9,yy-2],[xx+5,yy+23]],'#2780bf');
    }
    ctx.restore();ctx.strokeStyle='#baa080';ctx.lineWidth=1;ctx.strokeRect(x+.5,y,51,height);
  }
  function envelope(x,y,size=1){ctx.save();ctx.translate(x,y);ctx.scale(size,size);ctx.shadowColor='#ffc45c';ctx.shadowBlur=12;ctx.fillStyle='#ffe1a0';ctx.fillRect(-9,-6,18,12);ctx.shadowBlur=0;ctx.strokeStyle='#c98a32';ctx.lineWidth=1;ctx.strokeRect(-9,-6,18,12);ctx.beginPath();ctx.moveTo(-9,-6);ctx.lineTo(0,1);ctx.lineTo(9,-6);ctx.moveTo(-9,6);ctx.lineTo(-3,0);ctx.moveTo(9,6);ctx.lineTo(3,0);ctx.stroke();ctx.restore();}
  for(const p of pipes){rockColumn(p.x,0,p.gap-77,Math.floor(p.gap));rockColumn(p.x,p.gap+77,H-p.gap-77,Math.floor(p.gap)+2);if(!p.collected)envelope(p.x+26,p.gap,1+.08*Math.sin(clock*4));}
  for(let i=1;i<8;i++){ctx.globalAlpha=(1-i/8)*.6;ctx.fillStyle=i%2?'#ffa047':'#ffdc7e';ctx.fillRect(bird.x-19-i*7,bird.y+Math.sin(clock*15-i)*3,3,3);}ctx.globalAlpha=1;
  ctx.save();ctx.translate(bird.x,bird.y);ctx.rotate(Math.max(-.4,Math.min(.7,bird.vy/500)));
  const flame=8+Math.sin(clock*39)*3;
  poly([[-15,-4],[-24-flame,0],[-15,5]],'#ff993e');poly([[-15,-2],[-24,0],[-15,3]],'#ffe6a1');
  poly([[-8,-7],[-17,-15],[-5,-13],[5,-5]],'#e99a47','#f9c68c');
  poly([[-7,7],[-15,15],[-3,13],[7,5]],'#d68132','#f6b96d');
  const hull=ctx.createLinearGradient(0,-10,0,11);hull.addColorStop(0,'#fff4df');hull.addColorStop(.5,'#e7e5d8');hull.addColorStop(1,'#98aaba');
  poly([[-16,-7],[-7,-11],[8,-10],[17,-4],[18,4],[10,10],[-9,10],[-17,5]],hull,'#d9e5e6');
  ctx.fillStyle='#c26b2a';ctx.fillRect(-17,-5,4,10);ctx.fillStyle='#e9a455';ctx.fillRect(-13,-8,5,17);
  poly([[7,-8],[14,-3],[15,3],[8,6],[4,3],[4,-4]],'#126187','#76d9f1');poly([[7,-7],[11,-4],[7,0],[6,-3]],'#b9f3fc');
  ctx.fillStyle='#fff1cd';ctx.fillRect(-5,-3,8,6);ctx.strokeStyle='#d68d39';ctx.lineWidth=.7;ctx.strokeRect(-5,-3,8,6);ctx.beginPath();ctx.moveTo(-5,-3);ctx.lineTo(-1,0);ctx.lineTo(3,-3);ctx.stroke();
  ctx.fillStyle='#f9c269';ctx.fillRect(2,8,6,2);ctx.restore();
};
