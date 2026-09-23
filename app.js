'use strict';
const data=globalThis.CONTRACTORS, api=globalThis.EventMatch, form=document.querySelector('#search');
const $=s=>document.querySelector(s);
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const e=escapeHTML;
function options(name,items){items.forEach(value=>form.elements[name].add(new Option(value,value)));}
options('city',[...new Set(data.map(p=>p.city))]);
options('event',[...new Set(data.flatMap(p=>p.event_formats))]);
options('category',[...new Set(data.flatMap(p=>p.categories))].sort((a,b)=>a.localeCompare(b,'ru')));
options('language',[...new Set(data.flatMap(p=>p.languages))]);
const names={busy:'Заняты на дату',budget:'Стартовая цена выше бюджета',format:'Не берут этот формат',language:'Нет нужного языка',hours:'Не хватает часов'};
let previous=null;
function render(q){
  const r=api.recommend(data,q); $('#error').textContent='';
  const title=r.status==='matched'?'Подходят вашим условиям':r.status==='category_absent'?'Категории нет в городе':'Никто не прошёл по условиям';
  $('#result-header').innerHTML=`<div class="result-top"><h2>${title}</h2><span class="counter">${r.cards.length} из ${r.eligible} подходящих</span></div><p class="query-summary">${e(q.city)} · ${e(q.category)} · ${e(q.date.split('-').reverse().join('.'))} · до ${api.money(Number(q.budget))} ₸</p>`;
  $('#date-change').innerHTML='';
  if(previous && previous.query.date!==q.date && ['city','category','event','budget','hours','language','wishes'].every(k=>String(previous.query[k]??'')===String(q[k]??''))){
    const lost=previous.result.cards.filter(p=>p.busy_dates.includes(q.date));
    const newlyFree=r.cards.filter(p=>p.busy_dates.includes(previous.query.date));
    $('#date-change').innerHTML=`<section class="date-change"><strong>Изменилась только дата: ${e(previous.query.date.split('-').reverse().join('.'))} → ${e(q.date.split('-').reverse().join('.'))}</strong><p>Подходящих кандидатов: ${previous.result.eligible} → ${r.eligible}.${lost.length?' Теперь заняты: '+e(lost.map(p=>p.anon_name).join(', '))+'.':''}${newlyFree.length?' На новой дате свободны, а на предыдущей были заняты: '+e(newlyFree.map(p=>p.anon_name).join(', '))+'.':''}</p></section>`;
  }
  if(q.wishes?.trim()) $('#result-header').innerHTML+=`<p class="wish-summary">Пожелания: «${e(q.wishes)}». ${r.cards.some(p=>api.wishMatches(p.description,q.wishes).length)?'Выше — профили с совпадающими словами в описании.':'Совпадений по словам не нашли; показаны кандидаты по обязательным условиям.'}</p>`;
  $('#cards').innerHTML=r.cards.map((p,i)=>{
    const text=api.explanation(p,q,r.cards);
    return `<article class="card"><div class="card-top"><div class="identity"><span class="avatar" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><div><h3>${e(p.anon_name)}</h3><div class="meta">${e(q.category)} · ${e(p.city)}</div></div></div><div class="price">от ${api.money(p.price_from_kzt)} ₸<small>за мероприятие</small></div></div><div class="why"><span class="why-label">ПОЧЕМУ В ПОДБОРКЕ</span><p>${e(text.match)}</p><p class="detail">${e(text.detail)}</p></div><div class="tags"><span class="tag">${e(p.languages.join(' · '))}</span><span class="tag ${p.synthetic?'synthetic':''}">${p.synthetic?'Синтетический профиль':'Анонимизированный профиль'}</span>${p.price_imputed?'<span class="tag">Цена проставлена при подготовке данных</span>':''}${p.city_imputed?'<span class="tag">Город проставлен при подготовке данных</span>':''}</div></article>`;
  }).join('');
  document.querySelectorAll('.card').forEach((card,i)=>{
    const text=api.explanation(r.cards[i],q,r.cards);
    const div=document.createElement('div');div.className='differences';
    div.innerHTML=text.differences.map(s=>`<span class="difference">${e(s)}</span>`).join('')+(text.matched.length?`<span class="difference preference">Слова из пожеланий: ${e(text.matched.join(', '))}</span>`:'');
    if(div.childNodes.length) card.querySelector('.why').before(div);
  });
  if(!r.cards.length) $('#cards').innerHTML=`<div class="empty"><h3>${r.status==='category_absent'?'В каталоге нет этой категории в выбранном городе.':'В городе есть кандидаты, но условия не совпали.'}</h3><p>${r.status==='category_absent'?'Выберите другой город или категорию.':'Причины ниже. Можно изменить дату, бюджет или другие условия — мы пересчитаем подбор.'}</p></div>`;
  const reasons=Object.entries(r.reasons).filter(([,v])=>v);
  $('#diagnostics').innerHTML=r.total?`<section class="diagnostics"><h3>${r.eligible<3?'Почему меньше трёх?':'Как получилась подборка'}</h3><p>В городе в этой категории: ${r.total}. Проходят все условия: ${r.eligible}.${r.eligible>3?' Показываем первые три по правилам ранжирования.':''}</p>${reasons.length?`<div class="reason-list">${reasons.map(([k,v])=>`<span>${names[k]}: <strong>${v}</strong></span>`).join('')}</div><p class="hint">Один профиль может не пройти по нескольким причинам.</p>`:'<p>Все кандидаты в этой категории прошли проверку.</p>'}</section>`:'';
  previous={query:{...q},result:r};
  return {status:r.status,eligible:r.eligible,ids:r.cards.map(p=>p.id),reasons:r.reasons};
}
function run(q){api.validate(q);for(const [k,v] of Object.entries(q))if(form.elements[k])form.elements[k].value=v??'';return render(q);}
form.addEventListener('submit',event=>{event.preventDefault();try{render(Object.fromEntries(new FormData(form)));}catch(err){$('#error').textContent=err.message;}});
const dense={city:'Алматы',category:'Ведущий',date:'2026-10-15',event:'корпоратив',budget:1000000,hours:6,language:'русский',wishes:''};
const rare={...dense,category:'Флорист',event:'свадьба',budget:300000,hours:'',language:''};
const changed={...dense,date:'2026-10-16'};
const demos=[['Ведущие · 15 октября',dense],['Та же заявка · 16 октября',changed],['Флористы · 2 варианта',rare],['Бюджет 100 000 ₸',{...rare,budget:100000}],['Нет категории в Астане',{...rare,city:'Астана',category:'Декоратор'}],['С импровизацией',{...dense,wishes:'импровизация и интерактивы'}]];
demos.forEach(([label,q])=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',()=>run(q));$('#demo-buttons').append(b);});
run(dense);
if(document.modelContext?.registerTool){
 const lifecycle=new AbortController();
 Promise.resolve(document.modelContext.registerTool({name:'find_contractors',title:'Подобрать подрядчиков',description:'Проверить условия заказа и обновить видимые карточки подрядчиков.',inputSchema:{type:'object',properties:{city:{type:'string'},date:{type:'string'},event:{type:'string'},category:{type:'string'},budget:{type:'number'},hours:{type:'number'},language:{type:'string'},wishes:{type:'string',maxLength:500}},required:['city','date','event','category','budget'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:input=>run({hours:'',language:'',wishes:'',...input})},{signal:lifecycle.signal})).catch(()=>{});
 window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
