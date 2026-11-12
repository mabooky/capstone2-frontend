(function(){
var C=window.APP_CONFIG||{},$=function(i){return document.getElementById(i)};
function ls(k,v){try{if(v===undefined)return localStorage.getItem(k);if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v)}catch(e){}return null}
function esc(x){return String(x==null?"":x).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function fmt(ms){var x=Math.max(0,Math.floor(ms/1000));return Math.floor(x/60)+":"+String(x%60).padStart(2,"0")}
function num(x,lo,hi){x=parseFloat(x);return isNaN(x)?0:Math.max(lo,Math.min(hi,x))}

var qs=new URLSearchParams(location.search);
if(qs.get("store"))ls("ad.store",qs.get("store"));
var STORE=qs.get("store");
if(!STORE){
  $("lerr").textContent="잘못된 접근입니다. 매장 QR코드를 스캔해 주세요.";
  $("login").style.display="block";
  $("app").style.display="none";
  return;
}
var ACC=C.API_ORIGIN,BASE=ACC+"/stores/"+encodeURIComponent(STORE);
var adm=ls("ad.token"),hash=null,cat=[],now=null,queue=[],skew=0,polling=false;
var cfg={mode:"seeds",seeds:[],vMin:-0.5,vMax:0.5,eMin:-0.5,eMax:0.5,n:30},sres=[],pv=[];

async function api(url,o){
  o=o||{};var h={};if(o.body)h["Content-Type"]="application/json";if(o.tk)h.Authorization="Bearer "+o.tk;
  var r;try{r=await fetch(url,{method:o.method||"GET",headers:h,body:o.body?JSON.stringify(o.body):undefined,signal:o.signal})}
  catch(e){throw e&&e.name==="AbortError"?{code:"ABORT"}:{code:"NETWORK",message:"서버에 연결하지 못했어요."}}
  if(r.status===204)return null;
  var j=null;try{j=await r.json()}catch(e){}
  if(!r.ok){var er=(j&&j.error)||{};throw{status:r.status,code:er.code||"HTTP_"+r.status,message:er.message||"요청에 실패했어요.",retryAfterSec:er.retryAfterSec}}
  return j;
}
function show(v){$("login").hidden=v!=="login";$("app").hidden=v!=="app"}
/* 관리자 토큰이 무효하면(다른 기기에서 로그인 등) 재생을 멈추고 로그인 화면으로 */
function adminErr(e){
  if(e&&(e.code==="UNAUTHORIZED")){
    adm=null;ls("ad.token",null);
    if(player){try{player.disconnect()}catch(x){}player=null;dev=null}
    show("login");$("lerr").textContent="관리자 세션이 끝났어요. 다시 로그인해 주세요.";return true;
  }
  return false;
}

/* ───── 점주 로그인 ───── */
$("lbtn").onclick=async function(){
  try{
    var r=await api(BASE+"/admin/login",{method:"POST",body:{password:$("lp").value}});
    adm=r.token;ls("ad.token",adm);$("lp").value="";$("lerr").textContent="";enter();
  }catch(e){$("lerr").textContent=e.code==="INVALID_CREDENTIALS"?"비밀번호가 맞지 않아요.":e.code==="STORE_NOT_FOUND"?"등록되지 않은 매장 ID예요.":e.message}
};
$("lp").onkeydown=function(e){if(e.key==="Enter")$("lbtn").click()};
$("out").onclick=function(){adm=null;ls("ad.token",null);if(player){try{player.disconnect()}catch(x){}player=null;dev=null}show("login")};
function enter(){show("app");renderCfg();loadMood();spInit();poll()}

/* ───── 분위기 영역 (PUT /admin/mood, GET /admin/mood/preview) ───── */
function body(){
  return cfg.mode==="seeds"?{mode:"seeds",spotifyIds:cfg.seeds.map(function(s){return s.spotifyId}),n:cfg.n}
    :{mode:"range",valenceMin:cfg.vMin,valenceMax:cfg.vMax,energyMin:cfg.eMin,energyMax:cfg.eMax,n:cfg.n};
}
function qstr(b){var p=new URLSearchParams();Object.keys(b).forEach(function(k){if(k==="spotifyIds")b[k].forEach(function(i){p.append(k,i)});else p.append(k,b[k])});return p.toString()}
function bad(){
  if(cfg.mode==="seeds"){
    if(cfg.seeds.length<3)return "기준곡을 3곡 이상 골라 주세요. (현재 "+cfg.seeds.length+"곡)";
    if(cfg.seeds.length>cfg.n)return "기준곡은 카탈로그 곡 수("+cfg.n+")보다 많을 수 없어요.";
  }else if(cfg.vMin>cfg.vMax||cfg.eMin>cfg.eMax)return "최솟값이 최댓값보다 클 수 없어요.";
  return "";
}
function statusText(r){
  return r.status==="complete"?"영역 안 후보 "+r.candidateCount+"곡 중 "+r.returnedCount+"곡을 뽑았어요."
    :r.status==="insufficient-candidates"?"후보가 "+r.candidateCount+"곡뿐이라 "+r.returnedCount+"곡만 담을 수 있어요."
    :"영역 안에 후보가 없어요. 영역을 다시 설정해 주세요.";
}
var pAbort=null,pTm=null;
function schedule(){clearTimeout(pTm);pTm=setTimeout(preview,250);draw()}
async function preview(){
  if(pAbort)pAbort.abort();
  var m=bad();
  if(m){pv=[];$("cnt").textContent=m;draw();return}
  pAbort=new AbortController();
  try{
    var r=await api(BASE+"/admin/mood/preview?"+qstr(body()),{tk:adm,signal:pAbort.signal});
    pv=r.tracks;$("cnt").textContent="미리보기: "+statusText(r);
  }catch(e){if(e.code==="ABORT")return;if(!adminErr(e))$("cnt").textContent=e.message}
  draw();
}
async function loadMood(){
  try{
    var m=await api(BASE+"/mood");
    if(m){
      cfg.n=m.n;
      if(m.mode==="range"){cfg.mode="range";cfg.vMin=m.valenceMin;cfg.vMax=m.valenceMax;cfg.eMin=m.energyMin;cfg.eMax=m.energyMax}
      else{
        cfg.mode="seeds";var r=await api(BASE+"/admin/mood/preview?"+qstr(m),{tk:adm});
        cfg.seeds=m.spotifyIds.map(function(id){return r.tracks.filter(function(t){return t.spotifyId===id})[0]||{spotifyId:id,title:id,artist:"",valence:0,arousal:0}});
      }
    }
  }catch(e){if(adminErr(e))return}
  renderCfg();schedule();
}
$("apply").onclick=async function(){
  var m=bad();if(m){$("gmsg").textContent=m;return}
  try{
    var r=await api(BASE+"/admin/mood",{method:"PUT",body:body(),tk:adm});
    $("gmsg").textContent="적용했어요. "+statusText(r);poll();
  }catch(e){if(!adminErr(e))$("gmsg").textContent=e.message}
};
function renderCfg(){
  $("m1").className="btn"+(cfg.mode==="seeds"?"":" sub");$("m2").className="btn"+(cfg.mode==="range"?"":" sub");
  $("c1").hidden=cfg.mode!=="seeds";$("c2").hidden=cfg.mode!=="range";
  $("v0").value=cfg.vMin;$("v1").value=cfg.vMax;$("e0").value=cfg.eMin;$("e1").value=cfg.eMax;$("n").value=cfg.n;
  renderSeeds();renderSres();
}
function renderSeeds(){
  $("seeds").innerHTML=cfg.seeds.length?cfg.seeds.map(function(s,i){return '<div class="row"><span>'+esc(s.title)+' <span class="mute">'+esc(s.artist)+' · ('+s.valence+', '+s.arousal+')</span></span><button class="btn sub" data-rm="'+i+'">해제</button></div>'}).join(""):'<div class="mute">검색해서 기준곡을 추가해 주세요.</div>';
}
function renderSres(){
  var on={};cfg.seeds.forEach(function(s){on[s.spotifyId]=1});
  $("sr").innerHTML=sres===null?"":sres.length?sres.map(function(t,i){return '<div class="row"><span>'+esc(t.title)+' <span class="mute">'+esc(t.artist)+'</span></span><button class="btn'+(on[t.spotifyId]?" on":"")+'" data-sa="'+i+'">'+(on[t.spotifyId]?"해제":"추가")+'</button></div>'}).join(""):'<div class="mute">등록되지 않은 곡입니다.</div>';
}
var qt;
$("q").oninput=function(){
  clearTimeout(qt);var v=this.value.trim();
  qt=setTimeout(async function(){
    if(!v){sres=null;renderSres();return}
    try{sres=(await api(BASE+"/search?q="+encodeURIComponent(v)+"&limit=8&offset=0")).tracks}catch(e){sres=[]}
    renderSres();
  },300);
};
$("sr").onclick=function(e){
  var b=e.target.closest("[data-sa]");if(!b)return;
  var t=sres[+b.getAttribute("data-sa")],i=cfg.seeds.map(function(s){return s.spotifyId}).indexOf(t.spotifyId);
  if(i<0)cfg.seeds.push(t);else cfg.seeds.splice(i,1);
  renderSeeds();renderSres();schedule();
};
$("seeds").onclick=function(e){var b=e.target.closest("[data-rm]");if(b){cfg.seeds.splice(+b.getAttribute("data-rm"),1);renderSeeds();renderSres();schedule()}};
$("m1").onclick=function(){cfg.mode="seeds";renderCfg();schedule()};
$("m2").onclick=function(){cfg.mode="range";renderCfg();schedule()};
[["v0","vMin"],["v1","vMax"],["e0","eMin"],["e1","eMax"]].forEach(function(p){$(p[0]).oninput=function(){cfg[p[1]]=num(this.value,-1,1);schedule()}});
$("n").oninput=function(){cfg.n=Math.round(num(this.value,1,100));schedule()};
function draw(){
  function X(v){return (v+1)*50}function Y(e){return (1-e)*50}
  var h='<rect x="0" y="0" width="100" height="100" class="frame"/><line x1="50" y1="0" x2="50" y2="100" class="ax"/><line x1="0" y1="50" x2="100" y2="50" class="ax"/>';
  if(cfg.mode==="range"&&cfg.vMin<=cfg.vMax&&cfg.eMin<=cfg.eMax)h+='<rect class="reg" x="'+X(cfg.vMin)+'" y="'+Y(cfg.eMax)+'" width="'+(X(cfg.vMax)-X(cfg.vMin))+'" height="'+(Y(cfg.eMin)-Y(cfg.eMax))+'"/>';
  pv.forEach(function(t){h+='<circle class="pc" cx="'+X(t.valence)+'" cy="'+Y(t.arousal)+'" r="1.8"><title>'+esc(t.title+" · "+t.artist)+'</title></circle>'});
  if(cfg.mode==="seeds")cfg.seeds.forEach(function(t){h+='<circle class="pr" cx="'+X(t.valence)+'" cy="'+Y(t.arousal)+'" r="3.4"/>'});
  h+='<text x="50" y="109" class="lb" text-anchor="middle">정서 (Valence) →</text><text x="-6" y="50" class="lb" text-anchor="middle" transform="rotate(-90 -6 50)">에너지 (Arousal) →</text>';
  $("plot").innerHTML=h;
}

/* ───── 재생 상태·대기열 (GET /state 2초 폴링, 삭제는 DELETE /admin/queue/:id) ───── */
function tr(t,right){return '<div class="row"><span class="who"><img class="cov" src="'+esc(t.albumImageUrl)+'" alt="" loading="lazy"><span><b>'+esc(t.title)+'</b><span class="mute">'+esc(t.artist)+' · '+fmt(t.duration)+'</span></span></span>'+(right||"")+'</div>'}
function renderNow(){
  $("np").innerHTML=now?tr(now.track,'<span class="badge s-ok">'+(now.source==="request"?"신청곡":"자동 재생")+'</span>')+'<div class="bar"><i id="fill"></i></div><div class="mute" id="pt"></div>':'<div class="mute">재생 중인 곡이 없어요.</div>';
  renderProg();
}
function renderQueue(){
  $("qc").textContent=queue.length?"("+queue.length+"곡 대기)":"";
  $("ql").innerHTML=queue.length?queue.map(function(e,i){return tr(e.track,'<button class="btn sub" data-del="'+esc(e.queueId)+'" aria-label="'+esc(e.track.title)+' 삭제">삭제</button>')}).join(""):'<div class="mute">대기 중인 곡이 없어요. 대기열이 비면 카탈로그에서 자동으로 재생해요.</div>';
}
function renderCat(){
  $("cc").textContent=cat.length?"("+cat.length+"곡)":"";
  var LB={"already-queued":"대기 중","now-playing":"재생 중","recently-played":"최근 재생됨","out-of-mood":"범위 밖"};
  $("cl").innerHTML=cat.length?cat.map(function(t){return tr(t,LB[t.requestStatus]?'<span class="mute">'+LB[t.requestStatus]+'</span>':"")}).join(""):'<div class="mute">카탈로그가 비어 있어요. 영역을 설정해 주세요.</div>';
}
function renderProg(){
  if(!now||!$("fill"))return;
  var p=Date.now()+skew-now.startedAt;
  if(ps&&curId===now.track.spotifyId)p=ps.paused?ps.pos:ps.pos+(Date.now()-ps.ts);   // 점주 화면은 SDK 재생 위치를 사용
  p=Math.max(0,Math.min(now.track.duration,p));
  $("fill").style.width=(p/now.track.duration*100)+"%";$("pt").textContent=fmt(p)+" / "+fmt(now.track.duration);
}
$("ql").onclick=async function(e){
  var b=e.target.closest("[data-del]");if(!b)return;
  try{await api(BASE+"/admin/queue/"+encodeURIComponent(b.getAttribute("data-del")),{method:"DELETE",tk:adm})}
  catch(er){if(adminErr(er))return;if(er.code!=="QUEUE_ITEM_NOT_FOUND")pm(er.message)}
  poll();
};
async function poll(){
  if(polling||$("app").hidden)return;polling=true;
  try{
    var s=await api(BASE+"/state");
    skew=s.serverTime-Date.now();now=s.nowPlaying;queue=s.queue;
    if(s.catalogHash!==hash){hash=s.catalogHash;cat=await api(BASE+"/catalog")}
    renderNow();renderQueue();renderCat();
  }catch(e){}
  polling=false;
}

/* ───── Spotify 연결 (PKCE) 과 Web Playback SDK ───── */
var SP={t:ls("sp.t"),r:ls("sp.r"),x:+ls("sp.x")||0},player=null,dev=null,curId=null,ended=false,armed=false,busy=false,ps=null;
function pm(m){$("pmsg").textContent=m||""}
function spst(m){$("spst").textContent=m||""}
function b64u(buf){return btoa(String.fromCharCode.apply(null,new Uint8Array(buf))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
function spRedirect(){return C.SPOTIFY_REDIRECT_URI||location.origin+location.pathname}
async function spLogin(){
  if(!C.SPOTIFY_CLIENT_ID){pm("Spotify를 쓰려면 config.js에 SPOTIFY_CLIENT_ID를 채워 주세요.");return}
  var v=b64u(crypto.getRandomValues(new Uint8Array(48))),st=b64u(crypto.getRandomValues(new Uint8Array(12)));
  var ch=b64u(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v)));
  try{sessionStorage.setItem("sp.v",v);sessionStorage.setItem("sp.s",st)}catch(e){}
  location.href="https://accounts.spotify.com/authorize?"+new URLSearchParams({response_type:"code",client_id:C.SPOTIFY_CLIENT_ID,
    scope:"streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state",
    redirect_uri:spRedirect(),state:st,code_challenge_method:"S256",code_challenge:ch}).toString();
}
function spSave(j){
  SP.t=j.access_token;SP.x=Date.now()+j.expires_in*1000;if(j.refresh_token)SP.r=j.refresh_token;
  ls("sp.t",SP.t);ls("sp.x",String(SP.x));ls("sp.r",SP.r);
}
async function spCallback(){
  var code=qs.get("code");if(!code)return;
  var v=null,st=null;try{v=sessionStorage.getItem("sp.v");st=sessionStorage.getItem("sp.s");sessionStorage.removeItem("sp.v");sessionStorage.removeItem("sp.s")}catch(e){}
  history.replaceState(null,"",location.pathname);
  if(!v||qs.get("state")!==st)return;
  try{
    var r=await fetch("https://accounts.spotify.com/api/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
      body:new URLSearchParams({client_id:C.SPOTIFY_CLIENT_ID,grant_type:"authorization_code",code:code,redirect_uri:spRedirect(),code_verifier:v})});
    if(!r.ok)throw 0;spSave(await r.json());
  }catch(e){pm("Spotify 연결에 실패했어요. 다시 시도해 주세요.")}
}
async function spToken(){
  if(!SP.t)return null;
  if(Date.now()>SP.x-60000&&SP.r){
    try{
      var r=await fetch("https://accounts.spotify.com/api/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
        body:new URLSearchParams({client_id:C.SPOTIFY_CLIENT_ID,grant_type:"refresh_token",refresh_token:SP.r})});
      if(r.ok)spSave(await r.json());
    }catch(e){}
  }
  return SP.t;
}
function spInit(){
  if(!SP.t){spst("Spotify 연결 필요");return}
  if(player)return;
  spst("연결 중…");
  window.onSpotifyWebPlaybackSDKReady=function(){
    player=new Spotify.Player({name:"스마트 주크박스",getOAuthToken:function(cb){spToken().then(cb)},volume:.6});
    player.addListener("ready",function(d){dev=d.device_id;spst("재생 준비 완료");$("rs").disabled=$("nx").disabled=false});
    player.addListener("not_ready",function(){dev=null;spst("연결이 끊겼어요");$("rs").disabled=$("nx").disabled=true});
    player.addListener("account_error",function(){spst("Premium 계정이 필요해요")});
    player.addListener("authentication_error",function(){SP.t=null;ls("sp.t",null);spst("Spotify 다시 연결 필요")});
    player.addListener("initialization_error",function(e){spst(e.message)});
    player.addListener("player_state_changed",onState);
    player.connect();
  };
  var s=document.createElement("script");s.src="https://sdk.scdn.co/spotify-player.js";document.head.appendChild(s);
}
/* 곡이 끝났는지는 클라이언트가 판단: 같은 곡에서 멈춤+위치 0+이전 곡 목록에 같은 곡. 곡당 한 번만 처리 */
function onState(st){
  if(!st)return;
  ps={pos:st.position,ts:Date.now(),paused:st.paused};
  if(!st.paused)armed=true;
  var cur=st.track_window.current_track;
  if(armed&&!ended&&curId&&cur&&cur.id===curId&&st.paused&&st.position===0&&st.track_window.previous_tracks.some(function(p){return p.id===cur.id})){
    ended=true;
    (function go(){if(busy)setTimeout(go,500);else playNext()})();
  }
}
async function spPlay(id){
  var t=await spToken();if(!t||!dev)throw{message:"Spotify 플레이어가 아직 준비되지 않았어요."};
  var r=await fetch("https://api.spotify.com/v1/me/player/play?device_id="+dev,{method:"PUT",headers:{Authorization:"Bearer "+t,"Content-Type":"application/json"},body:JSON.stringify({uris:["spotify:track:"+id]})});
  if(!r.ok)throw{message:"Spotify 재생에 실패했어요. ("+r.status+")"};
  curId=id;ended=false;armed=false;
}
async function reportPlay(t){   // 보고가 성공한 뒤에만 재생
  await api(BASE+"/admin/now-playing",{method:"PUT",body:{spotifyId:t.spotifyId},tk:adm});
  await spPlay(t.spotifyId);poll();
}
async function pickNext(){
  var s=await api(BASE+"/state");
  return s.queue.length?s.queue[0].track:api(BASE+"/admin/fallback-track",{tk:adm});
}
function fail(e){
  if(adminErr(e))return;
  pm({NO_TRACKS:"재생할 곡이 없어요. 분위기 영역을 먼저 설정해 주세요.",OUT_OF_MOOD:"영역 밖의 곡이라 재생할 수 없어요."}[e.code]||e.message||"재생에 실패했어요.");
}
async function playNext(){
  if(busy||!dev)return;busy=true;pm("");
  try{
    var t=await pickNext();
    try{await reportPlay(t)}catch(e){if(e.code!=="NOT_NEXT_IN_QUEUE")throw e;await reportPlay(await pickNext())}
  }catch(e){fail(e)}
  busy=false;
}
async function resume(){   // 재접속 절차: 서버 상태에 따라 처음부터 다시 재생
  if(busy||!dev)return;busy=true;pm("");
  try{
    if(player&&player.activateElement)await player.activateElement();
    var s=await api(BASE+"/state"),n=s.nowPlaying,q=s.queue,t;
    if(n&&(n.source==="request"||!q.length))t=n.track;
    else if(q.length)t=q[0].track;
    else t=await api(BASE+"/admin/fallback-track",{tk:adm});
    await reportPlay(t);
  }catch(e){fail(e)}
  busy=false;
}
$("spb").onclick=spLogin;
$("rs").onclick=resume;
$("nx").onclick=function(){if(player&&player.activateElement)player.activateElement();playNext()};

/* 시작 */
async function init(){
  if(!STORE){$("lerr").textContent="매장 ID가 없어요. config.js의 STORE_ID를 채우거나 주소 뒤에 ?store=매장ID를 붙여 주세요.";show("login");return}
  await spCallback();
  try{var s=await api(BASE);$("sname").textContent=s.name;$("lstore").textContent=s.name}catch(e){if(e.code==="STORE_NOT_FOUND")$("lerr").textContent="등록되지 않은 매장 ID예요."}
  if(adm)enter();else show("login");
  setInterval(poll,2000);setInterval(renderProg,1000);
}
init();
})();
