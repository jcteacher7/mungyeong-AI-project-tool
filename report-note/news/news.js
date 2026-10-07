/* 아이들이 취재 노트에서 들어오면(?c=반) 선생님이 켠 신문만 넘겨 볼 수 있게 함.
   주소에 반 번호가 없으면(선생님이 직접 열거나 인쇄할 때) 모두 보임. */
(function(){
  var m=/[?&]c=(\d+)/.exec(location.search); if(!m)return;
  var cls=+m[1], me=document.body.classList.contains('now')?'now':'past';
  var other=document.querySelector('[data-other]');
  if(other){ other.href=other.getAttribute('href')+'?c='+cls; other.hidden=true; }
  function shown(k){
    if(!k)return [];
    if(Array.isArray(k.res))return k.res;
    var o=k.open||[], r=[];
    if(o.some(function(x){return x.indexOf('past:')===0;}))r.push('past');
    if(o.some(function(x){return x.indexOf('now:')===0;})||o.indexOf('cmp')>=0)r.push('now');
    return r;
  }
  var C=window.NOTE_CFG||{};
  fetch(String(C.url||'').replace(/\/$/,'')+'/rest/v1/entries?select=value&group_id=eq.911&key=eq.cfg',
    {headers:{apikey:C.key,Authorization:'Bearer '+C.key},cache:'no-store'})
  .then(function(r){return r.json();})
  .then(function(rows){
    var cfg=rows&&rows[0]&&rows[0].value||{};
    var k=(cfg.classes||[]).filter(function(c){return c.id===cls;})[0];
    var on=shown(k);
    if(other&&on.indexOf(me==='past'?'now':'past')>=0)other.hidden=false;
    if(on.indexOf(me)<0){
      var s=document.querySelector('.sheet'); var pb=document.querySelector('.tools button'); if(pb)pb.hidden=true;
      if(s)s.outerHTML='<div class="closed"><p>선생님이 아직 열지 않은 신문이에요.</p><p class="sub">이 창을 닫고 취재 노트로 돌아가요.</p></div>';
    }
  }).catch(function(){});
})();
