(function(){
var C=window.APP_CONFIG||{},$=function(i){return document.getElementById(i)};
function ls(k,v){try{if(v===undefined)return localStorage.getItem(k);if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v)}catch(e){}return null}
function esc(x){return String(x==null?"":x).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function fmt(ms){var x=Math.max(0,Math.floor(ms/1000));return Math.floor(x/60)+":"+String(x%60).padStart(2,"0")}

var qs=new URLSearchParams(location.search);
if(qs.get("store"))ls("sj.store",qs.get("store"));
var STORE=qs.get("store");
if(!STORE){
  $("access-error").hidden=false;
  return;
}
var ACC=C.API_ORIGIN,BASE=ACC+"/stores/"+encodeURIComponent(STORE);
var token=ls("sj.token"),nick=ls("sj.nick")||"",hash=null,cat=[],now=null,queue=[],skew=0,me=null,hist={items:[],total:0},sr=null,polling=false;
var LB={"out-of-mood":"범위 밖","already-queued":"대기 중","now-playing":"재생 중","recently-played":"최근 재생됨"};

async function api(url,o){
  o=o||{};var h={};if(o.body)h["Content-Type"]="application/json";
  if(token&&!o.noauth)h.Authorization="Bearer "+token;
  var r;try{r=await fetch(url,{method:o.method||"GET",headers:h,body:o.body?JSON.stringify(o.body):undefined})}
  catch(e){throw{code:"NETWORK",message:"서버에 연결하지 못했어요."}}
  if(r.status===204)return null;
  var j=null;try{j=await r.json()}catch(e){}
  if(!r.ok){var er=(j&&j.error)||{};throw{status:r.status,code:er.code||"HTTP_"+r.status,message:er.message||"요청에 실패했어요.",retryAfterSec:er.retryAfterSec}}
  return j;
}
function msg(m){$("msg").textContent=m||""}

/* 카카오 로그인 (4절): authorize → 콜백에서 state 확인 → code 전달 → 토큰 저장 → 주소창의 code 제거 */
function login(){
  if(!window.Kakao||!C.KAKAO_JS_KEY){$("cfg").textContent="카카오 로그인을 쓰려면 config.js에 KAKAO_JS_KEY를 채워 주세요.";return}
  if(!Kakao.isInitialized())Kakao.init(C.KAKAO_JS_KEY);
  var st=Math.random().toString(36).slice(2)+Date.now().toString(36);
  try{sessionStorage.setItem("sj.kstate",st)}catch(e){}
  Kakao.Auth.authorize({redirectUri:C.KAKAO_REDIRECT_URI||location.origin+location.pathname,state:st});
}
async function callback(){
  var code=qs.get("code");if(!code)return;
  var st=qs.get("state"),saved=null;
  try{saved=sessionStorage.getItem("sj.kstate");sessionStorage.removeItem("sj.kstate")}catch(e){}
  history.replaceState(null,"",location.pathname);
  if(!saved||st!==saved){msg("로그인 확인값이 달라 중단했어요. 다시 시도해 주세요.");return}
  try{
    var r=await api(ACC+"/auth/kakao/login",{method:"POST",body:{code:code},noauth:true});
    token=r.token;nick=(r.user&&r.user.nickname)||"";ls("sj.token",token);ls("sj.nick",nick);
  }catch(e){msg(e.code==="INVALID_KAKAO_CODE"?"카카오 로그인에 실패했어요. 다시 시도해 주세요.":e.code==="KAKAO_UNAVAILABLE"?"카카오 서버와 통신하지 못했어요. 처음부터 다시 로그인해 주세요.":e.message)}
}
function clearAuth(){token=null;nick="";me=null;hist={items:[],total:0};ls("sj.token",null);ls("sj.nick",null);renderAll()}
function unauth(e){if(e&&e.code==="CUSTOMER_UNAUTHORIZED"){clearAuth();return true}return false}
async function logout(){try{await api(ACC+"/auth/logout",{method:"POST"})}catch(e){}clearAuth()}
$("acct").onclick=function(e){
  if(e.target.id==="login")login();else if(e.target.id==="out")logout();
};

/* 화면 */
function canReq(){return !!token&&(!me||me.canRequest!==false)}
function trow(t,btn){return '<div class="row"><span class="who"><img class="cov" src="'+esc(t.albumImageUrl)+'" alt="" loading="lazy"><span><b>'+esc(t.title)+'</b><span class="mute">'+esc(t.artist)+' · '+fmt(t.duration)+'</span></span></span>'+(btn||"")+'</div>'}
function rbtn(t){var s=t.requestStatus;return '<button class="btn" data-id="'+esc(t.spotifyId)+'"'+(s==="available"&&canReq()?"":" disabled")+'>'+(s==="available"?"신청":LB[s]||"신청")+'</button>'}
function renderAcct(){
  $("acct").innerHTML=token?'<span class="mute">'+esc(nick||"로그인됨")+' 님</span> <button class="btn sub" id="out">로그아웃</button>':'<button class="btn kakao" id="login">카카오로 로그인</button>';
  $("cmsg").textContent=!token?"로그인하면 곡을 신청하고 이전 신청 이력을 볼 수 있어요.":me&&me.reason==="MY_REQUEST_PENDING"?"내 신청곡이 대기 중이에요. 재생이 시작되면 다시 신청할 수 있어요.":"";
}
function renderCat(){
  $("cl").innerHTML=cat.length?cat.map(function(t){return trow(t,rbtn(t))}).join(""):'<div class="mute">점주님이 아직 카탈로그를 만들지 않았어요.</div>';
}
function renderSearch(){
  if(!sr){$("sr").innerHTML="";return}
  $("sr").innerHTML=sr.tracks.length?sr.tracks.map(function(t){return trow(t,rbtn(t))}).join(""):'<div class="mute">'+esc(sr.err||"등록되지 않은 곡입니다.")+'</div>';
}
function renderPlay(){
  $("np").innerHTML=now?trow(now.track)+'<div class="bar"><i id="fill"></i></div><div class="mute" id="pt"></div>':'<div class="mute">재생 중인 곡이 없어요.</div>';
  $("ql").innerHTML=queue.length?queue.map(function(e,i){return trow(e.track,(e.mine?'<span class="badge s-ok">내 신청</span>':'<span class="mute">'+(i+1)+'번째</span>'))}).join(""):'<div class="mute">대기 중인 곡이 없어요.</div>';
  renderProg();
}
function renderProg(){
  if(!now||!$("fill"))return;
  var p=Math.max(0,Math.min(now.track.duration,Date.now()+skew-now.startedAt));
  $("fill").style.width=(p/now.track.duration*100)+"%";$("pt").textContent=fmt(p)+" / "+fmt(now.track.duration);
}
function renderHist(){
  $("hl").innerHTML=!token?'<div class="mute">로그인하면 이전에 신청한 곡을 볼 수 있어요.</div>':hist.items.length?hist.items.map(function(r){
    return trow(r.track,'<span class="mute">'+esc(r.storeName)+'<br>'+new Date(r.requestedAt).toLocaleDateString("ko-KR")+'</span>')}).join(""):'<div class="mute">아직 신청한 곡이 없어요.</div>';
  $("more").hidden=!(token&&hist.items.length<hist.total);
}
function renderAll(){renderAcct();renderCat();renderSearch();renderPlay();renderHist()}

/* 데이터 */
async function loadCat(){try{cat=await api(BASE+"/catalog")}catch(e){if(!unauth(e))cat=cat}renderCat()}
async function loadHist(reset){
  if(!token)return;
  try{
    var off=reset?0:hist.items.length,r=await api(ACC+"/me/requests?limit=20&offset="+off);
    hist.items=reset?r.requests:hist.items.concat(r.requests);hist.total=r.total;
  }catch(e){if(!unauth(e))msg(e.message)}
  renderHist();
}
$("more").onclick=function(){loadHist(false)};
async function poll(){
  if(polling)return;polling=true;
  try{
    var s=await api(BASE+"/state");
    skew=s.serverTime-Date.now();now=s.nowPlaying;queue=s.queue;
    if(s.catalogHash!==hash){hash=s.catalogHash;await loadCat()}   // 카탈로그가 바뀌면 다시 불러오기
    if(token){
      try{me=await api(BASE+"/me")}catch(e){if(!unauth(e))throw e}
      if(me&&me.reason==="LOGIN_REQUIRED"){clearAuth()}
    }
    renderAcct();renderCat();renderSearch();renderPlay();
  }catch(e){if(e.code==="NETWORK")$("cmsg").textContent=e.message}
  polling=false;
}
async function request(id){
  if(!token)return;msg("");
  try{
    var q=await api(BASE+"/queue",{method:"POST",body:{spotifyId:id}});
    queue.push(q);me={canRequest:false,reason:"MY_REQUEST_PENDING"};msg("신청했어요!");renderAll();loadHist(true);
  }catch(e){
    if(unauth(e)){msg("로그인이 필요해요.");return}
    var m={OUT_OF_MOOD:"지금 분위기에 맞지 않는 곡이에요.",TRACK_ALREADY_QUEUED:"이미 대기 중이거나 재생 중인 곡이에요.",MY_REQUEST_PENDING:"내가 신청한 곡이 아직 대기 중이에요."}[e.code];
    if(e.code==="TRACK_COOLDOWN")m="최근에 재생된 곡이에요. 약 "+Math.max(1,Math.ceil((e.retryAfterSec||0)/60))+"분 뒤에 다시 신청할 수 있어요.";
    msg(m||e.message);loadCat();poll();
  }
}
function onReq(e){var b=e.target.closest("[data-id]");if(b&&!b.disabled)request(b.getAttribute("data-id"))}
$("cl").onclick=onReq;$("sr").onclick=onReq;
var tm;
$("q").oninput=function(){
  clearTimeout(tm);var v=this.value.trim();
  tm=setTimeout(async function(){
    if(!v){sr=null;renderSearch();return}
    try{sr=await api(BASE+"/search?q="+encodeURIComponent(v)+"&limit=20&offset=0")}catch(e){sr={tracks:[],err:e.message}}
    renderSearch();
  },300);
};

async function init(){
  renderAll();
  if(!STORE){$("cfg").textContent="매장 ID가 없어요. config.js의 STORE_ID를 채우거나 주소 뒤에 ?store=매장ID를 붙여 주세요.";return}
  await callback();
  try{var s=await api(BASE);$("sname").textContent=s.name}catch(e){if(e.code==="STORE_NOT_FOUND"){$("cfg").textContent="등록되지 않은 매장 ID예요.";return}}
  await poll();renderAll();
  if(token)loadHist(true);
  setInterval(poll,2000);setInterval(renderProg,1000);
}
init();
})();
