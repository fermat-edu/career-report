/* 제출 도우미: 화면 꺼짐 막기 · 진행 알림창 · 잠금/끊김 뒤 이어 보내기 */
(function(){
  const DB="fermat-submit", ST="q";
  function db(){ return new Promise((res,rej)=>{ const r=indexedDB.open(DB,1); r.onupgradeneeded=()=>r.result.createObjectStore(ST); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
  async function put(k,v){ const d=await db(); return new Promise((res,rej)=>{ const t=d.transaction(ST,"readwrite"); t.objectStore(ST).put(v,k); t.oncomplete=res; t.onerror=()=>rej(t.error); }); }
  async function get(k){ const d=await db(); return new Promise((res,rej)=>{ const q=d.transaction(ST).objectStore(ST).get(k); q.onsuccess=()=>res(q.result); q.onerror=()=>rej(q.error); }); }
  async function del(k){ const d=await db(); return new Promise(res=>{ const t=d.transaction(ST,"readwrite"); t.objectStore(ST).delete(k); t.oncomplete=res; t.onerror=res; }); }

  /* 화면 꺼짐 막기 (지원하는 브라우저만) */
  let lock=null, want=false;
  async function grab(){ try{ if(want&&!lock&&navigator.wakeLock&&document.visibilityState==="visible"){ lock=await navigator.wakeLock.request("screen"); lock.addEventListener("release",()=>{lock=null;}); } }catch(e){} }
  function awake(on){ want=!!on; if(on) grab(); else if(lock){ try{lock.release();}catch(e){} lock=null; } }
  document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible") grab(); });

  /* 진행 알림창 */
  const css=document.createElement("style");
  css.textContent='.skw{position:fixed;top:0;right:0;bottom:0;left:0;z-index:9999;background:rgba(10,20,22,.55);display:flex;align-items:center;justify-content:center;padding:20px}'+
   '.skw[hidden]{display:none}.skw>div{background:#fff;color:#1d2b2d;border-radius:18px;max-width:380px;width:100%;padding:24px 22px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.25);font-family:inherit}'+
   '.skw .sp{width:42px;height:42px;margin:0 auto 12px;border:4px solid #d6e6e8;border-top-color:#2f8792;border-radius:50%;animation:skr 1s linear infinite}@keyframes skr{to{transform:rotate(360deg)}}'+
   '.skw h3{margin:0 0 8px;font-size:19px}.skw p{margin:6px 0;font-size:14.5px;line-height:1.55;white-space:pre-line}.skw .st{color:#2f8792;font-weight:700}.skw .tip{color:#6b7b7d;font-size:13px}';
  document.head.appendChild(css);
  const box=document.createElement("div"); box.className="skw"; box.hidden=true; box.setAttribute("role","alertdialog"); box.setAttribute("aria-live","polite");
  box.innerHTML='<div><div class="sp" aria-hidden="true"></div><h3>제출하는 중이에요</h3><p class="msg"></p><p class="st"></p><p class="tip">끝나면 ‘제출 완료’ 창이 떠요. 그때까지 이 화면을 켜 두세요.\n혹시 화면이 잠겨도 다시 열면 이어서 보내요.</p></div>';
  document.addEventListener("DOMContentLoaded",()=>document.body.appendChild(box)); if(document.body) document.body.appendChild(box);
  let mo=null;
  function show(msg,statusEl){
    box.querySelector(".msg").textContent=msg||"";
    const st=box.querySelector(".st"); st.textContent=statusEl?statusEl.textContent:"";
    if(mo) mo.disconnect(); if(statusEl){ mo=new MutationObserver(()=>{ st.textContent=statusEl.textContent; }); mo.observe(statusEl,{childList:true,characterData:true,subtree:true}); }
    box.hidden=false; awake(true);
  }
  function hide(){ box.hidden=true; if(mo){mo.disconnect();mo=null;} awake(false); }
  function sizeMsg(bytes){ const mb=bytes/1048576; return "파일 크기 "+(mb<1?"1MB 미만":mb.toFixed(1)+"MB")+" · "+(mb<3?"30초~1분":mb<8?"1~2분":"2~4분")+" 정도 걸려요."; }

  function b64(blob){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(String(r.result).split(",")[1]); r.onerror=rej; r.readAsDataURL(blob); }); }
  const visible=()=>new Promise(res=>{ if(document.visibilityState==="visible") return res(); const f=()=>{ if(document.visibilityState==="visible"){ document.removeEventListener("visibilitychange",f); res(); } }; document.addEventListener("visibilitychange",f); });
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  /* 보내기: 성공하면 true. 화면이 잠겨 끊기면 다시 열릴 때 자동으로 다시 보냄 */
  async function post(url,key,label,blob,statusEl){
    const rec={label,blob,time:Date.now()};
    try{ await put(key,rec); }catch(e){}
    const body=JSON.stringify({label,pdf:await b64(blob)});
    for(let tryN=1;tryN<=4;tryN++){
      let hiddenDuring=document.visibilityState!=="visible";
      const onHide=()=>{ if(document.visibilityState!=="visible") hiddenDuring=true; };
      document.addEventListener("visibilitychange",onHide);
      try{
        if(statusEl) statusEl.textContent=tryN===1?"선생님께 보내는 중…":"끊긴 제출을 다시 보내는 중… ("+tryN+"번째)";
        const r=await fetch(url,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body});
        const j=await r.json();
        if(!j.ok) throw new Error(j.error||"fail");
        document.removeEventListener("visibilitychange",onHide);
        await del(key).catch(()=>{}); return true;
      }catch(e){
        document.removeEventListener("visibilitychange",onHide);
        if(e instanceof TypeError && !hiddenDuring && navigator.onLine!==false){
          // 응답만 못 읽은 경우가 많아요: 응답 없이 한 번 보내기
          try{ await fetch(url,{method:"POST",mode:"no-cors",headers:{"Content-Type":"text/plain;charset=utf-8"},body}); await del(key).catch(()=>{}); return true; }catch(_){}
        }
        if(tryN===4) return false;
        if(statusEl) statusEl.textContent=hiddenDuring?"화면이 잠겨서 멈췄어요. 다시 열면 이어서 보내요.":"연결이 끊겼어요. 잠시 뒤 다시 보내요…";
        await visible(); await sleep(1500);
        if(navigator.onLine===false){ if(statusEl) statusEl.textContent="인터넷이 끊겼어요. 연결되면 다시 보내요."; await new Promise(r=>window.addEventListener("online",r,{once:true})); }
      }
    }
    return false;
  }
  /* 지난번에 다 못 보낸 제출이 있으면 */
  async function pending(key){ try{ return await get(key); }catch(e){ return null; } }
  async function clear(key){ try{ await del(key); }catch(e){} }
  /* PDF 만드는 중 표시 (창이 닫히면 다음에 열 때 알려 줌) */
  function mark(key,on){ try{ on?localStorage.setItem(key+"_busy",String(Date.now())):localStorage.removeItem(key+"_busy"); }catch(e){} }
  function wasBusy(key){ try{ const t=+localStorage.getItem(key+"_busy"); return t&&Date.now()-t<6*3600e3; }catch(e){ return false; } }

  /* 카카오톡·인스타 등 앱 안 브라우저: PDF 저장이 막혀 있어서 바깥 브라우저로 열도록 안내 */
  (function(){
    const ua=navigator.userAgent||"";
    const kakao=/KAKAOTALK/i.test(ua), other=/Instagram|FBAN|FBAV|Line\/|NAVER\(inapp|everytimeApp|DaumApps|SamsungBrowser\/.*CrossApp/i.test(ua);
    if(!kakao&&!other) return;
    const st=document.createElement("style");
    st.textContent='.iab{position:sticky;top:0;z-index:9998;background:#fee500;color:#1d1d1d;padding:12px 14px;font-size:14.5px;line-height:1.5;box-shadow:0 2px 8px rgba(0,0,0,.15)}.iab b{display:block;font-size:15.5px}.iab a,.iab button{display:inline-block;margin-top:8px;background:#1d1d1d;color:#fff;border:0;border-radius:10px;padding:9px 14px;font:inherit;font-weight:700;text-decoration:none}';
    document.head.appendChild(st);
    const bar=document.createElement("div"); bar.className="iab"; bar.setAttribute("role","alert");
    const url=location.href.split("#")[0];
    bar.innerHTML='<b>⚠️ 카카오톡 안에서 열면 PDF 저장이 안 될 수 있어요</b>크롬·사파리·삼성 인터넷으로 열어서 써 주세요. (여기서 쓴 내용은 다른 브라우저로 넘어가지 않아요)<br>'+
      (kakao?'<a href="kakaotalk://web/openExternal?url='+encodeURIComponent(url)+'">다른 브라우저로 열기</a>':'<button type="button">주소 복사하기</button> <span style="font-size:13px">→ 오른쪽 위 ⋮ 메뉴에서 ‘다른 브라우저로 열기’를 눌러도 돼요</span>');
    const put=()=>{ document.body.insertBefore(bar,document.body.firstChild); const b=bar.querySelector("button"); if(b) b.onclick=()=>{ try{ navigator.clipboard.writeText(url); b.textContent="복사했어요!"; }catch(e){ prompt("이 주소를 복사하세요",url); } }; };
    if(document.body) put(); else document.addEventListener("DOMContentLoaded",put);
  })();

  /* 꼭 써야 하는 칸을 안 쓰고 제출을 누르면: 무엇을 써야 하는지 창으로 알려 주고, 그 칸을 빨갛게 표시 */
  const rq=document.createElement("style");
  rq.textContent='.skreq{position:fixed;inset:0;z-index:10000;background:rgba(10,20,22,.55);display:flex;align-items:center;justify-content:center;padding:20px}.skreq[hidden]{display:none}'+
   '.skreq>div{background:#fff;color:#1d2b2d;border-radius:18px;max-width:380px;width:100%;padding:22px;box-shadow:0 10px 40px rgba(0,0,0,.25)}'+
   '.skreq h3{margin:0 0 6px;font-size:19px;text-align:center}.skreq p{margin:0 0 12px;font-size:14px;color:#5f6d70;text-align:center;line-height:1.5}'+
   '.skreq ul{list-style:none;margin:0 0 16px;padding:0}.skreq li{background:#fff1f0;border:1.5px solid #e5534b;border-radius:10px;padding:10px 12px;margin:6px 0;font-size:15.5px;font-weight:700;color:#b42318}'+
   '.skreq button{display:block;width:100%;font:inherit;font-size:16px;font-weight:800;background:#f2c94c;color:#1d2b2d;border:0;border-radius:12px;padding:13px}'+
   '.skmiss{outline:3px solid #e5534b!important;outline-offset:2px;background:#fff7f6!important}.skmissmsg{color:#b42318;font-size:13px;font-weight:700;margin-top:4px}';
  document.head.appendChild(rq);
  const rbox=document.createElement("div"); rbox.className="skreq"; rbox.hidden=true; rbox.setAttribute("role","alertdialog"); rbox.setAttribute("aria-modal","true");
  rbox.innerHTML='<div><h3>✏️ 아직 안 쓴 칸이 있어요</h3><p>오류가 아니에요! 아래 칸을 먼저 써야<br>선생님께 제출할 수 있어요.</p><ul></ul><button type="button">확인하고 쓰러 가기</button></div>';
  const putR=()=>document.body.appendChild(rbox); if(document.body) putR(); else document.addEventListener("DOMContentLoaded",putR);
  function clearMiss(el){ el.classList.remove("skmiss"); const m=el.parentNode&&el.parentNode.querySelector(".skmissmsg"); if(m) m.remove(); }
  /* items: [{id, label}] — 빈 칸만 넘겨요. 하나도 없으면 false */
  function require(items){
    if(!items||!items.length) return false;
    rbox.querySelector("ul").innerHTML=items.map(x=>'<li>'+x.label+'</li>').join("");
    items.forEach(x=>{ const el=document.getElementById(x.id); if(!el) return; el.classList.add("skmiss");
      if(!el.parentNode.querySelector(".skmissmsg")){ const m=document.createElement("div"); m.className="skmissmsg"; m.textContent="↑ 여기를 써 주세요"; el.insertAdjacentElement("afterend",m); }
      const off=()=>{ if(String(el.value||"").trim()) clearMiss(el); }; el.addEventListener("input",off); el.addEventListener("change",off); });
    rbox.hidden=false; const b=rbox.querySelector("button"); b.focus();
    b.onclick=()=>{ rbox.hidden=true; const el=document.getElementById(items[0].id); if(el){ try{ el.scrollIntoView({block:"center",behavior:"smooth"}); }catch(e){ el.scrollIntoView(); } setTimeout(()=>{ try{ el.focus({preventScroll:true}); }catch(e){ el.focus(); } },350); } };
    return true;
  }

  window.SubmitKit={show,hide,sizeMsg,post,pending,clear,awake,mark,wasBusy,require};
})();
