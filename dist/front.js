'use strict';
const data=globalThis.CONTRACTORS, api=globalThis.EventMatch;
const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={busy:'Заняты на дату',budget:'Стартовая цена выше бюджета',format:'Не берут этот формат',language:'Нет нужного языка',hours:'Не хватает часов'};
let previous=null,current=null,openedId=null,toastTimer;
let saved=[];try{const value=JSON.parse(localStorage.getItem('mereke_shortlist')||'[]');if(Array.isArray(value))saved=[...new Set(value.filter(id=>data.some(p=>p.id===id)))];}catch{}
const dense={city:'Алматы',date:'2026-10-15',event:'корпоратив',category:'Ведущий',budget:1000000,hours:6,language:'русский',wishes:''};
const florist={...dense,event:'свадьба',category:'Флорист',budget:300000,hours:'',language:''};
const demos=[['Ведущие · 15 октября',dense],['Та же заявка · 16 октября',{...dense,date:'2026-10-16'}],['Флористы · 2 варианта',florist],['Бюджет 100 000 ₸',{...florist,budget:100000}],['Нет категории в Астане',{...florist,city:'Астана',category:'Декоратор'}],['С импровизацией',{...dense,wishes:'импровизация и интерактивы'}]];
function fill(id,values){values.forEach(v=>$(id).add(new Option(v,v)));}
fill('filter-city',[...new Set(data.map(p=>p.city))]);fill('filter-format',[...new Set(data.flatMap(p=>p.event_formats))]);fill('filter-category',[...new Set(data.flatMap(p=>p.categories))].sort((a,b)=>a.localeCompare(b,'ru')));fill('filter-language',[...new Set(data.flatMap(p=>p.languages))]);
$('filter-budget').max=Math.max(...data.map(p=>p.price_from_kzt));
function query(){return {city:$('filter-city').value,date:$('filter-date').value,event:$('filter-format').value,category:$('filter-category').value,budget:Number($('budget-number').value),hours:$('filter-hours').value,language:$('filter-language').value,wishes:$('filter-wishes').value};}
function updateBudgetDisplay(value,fromSlider=false){if(fromSlider)$('budget-number').value=value;$('budget-display').textContent=api.money(Number(value))+' ₸';}
function setExactBudget(value){$('budget-number').value=value;$('filter-budget').value=Math.min(Number(value),Number($('filter-budget').max));updateBudgetDisplay(value);applyFilters();}
function preset(q){api.validate(q);for(const [key,id] of Object.entries({city:'city',date:'date',event:'format',category:'category',hours:'hours',language:'language',wishes:'wishes'}))$('filter-'+id).value=q[key]??'';$('budget-number').value=q.budget;$('filter-budget').value=q.budget;updateBudgetDisplay(q.budget);return applyFilters();}
function resetFilters(){preset(dense);}
function increaseBudget(){setExactBudget(Math.ceil(Number($('budget-number').value)*1.3));}
function flagHTML(p){return `<span class="tag ${p.synthetic?'synthetic':''}">${p.synthetic?'Синтетический профиль':'Анонимизированный профиль'}</span>${p.price_imputed?'<span class="tag">Цена проставлена организаторами</span>':''}${p.city_imputed?'<span class="tag">Город проставлен организаторами</span>':''}`;}
function factsHTML(p){return `<span class="tag">${esc(p.languages.join(' · '))}</span><span class="tag">${p.max_hours==null?'Не привязано к часам присутствия':'До '+p.max_hours+' ч на площадке'}</span>`;}
function applyFilters(){
 globalThis.MerekeAI?.reset();
 const q=query();let r;
 try{r=api.recommend(data,q);$('form-error').hidden=true;}catch(err){$('form-error').hidden=false;$('form-error').textContent=err.message;return {status:'invalid',error:err.message};}
 $('results-count').textContent=r.status==='category_absent'?'Категории нет в городе':r.status==='no_match'?'Никто не прошёл условия':`${r.cards.length} из ${r.eligible} подходящих`;
 $('query-summary').innerHTML=`<p>${esc(q.city)} · ${esc(q.category)} · ${esc(q.date.split('-').reverse().join('.'))} · до ${api.money(q.budget)} ₸</p>`+(q.wishes.trim()?`<p class="wish-summary">Пожелания: «${esc(q.wishes)}». ${r.cards.some(p=>api.wishMatches(p.description,q.wishes).length)?'Совпадающие слова в описании учитываются в порядке.':'Совпадений по словам нет; показаны подходящие по обязательным условиям.'}</p>`:'');
 $('date-change').innerHTML='';
 if(previous && previous.q.date!==q.date && ['city','category','event','budget','hours','language','wishes'].every(k=>String(previous.q[k]??'')===String(q[k]??''))){
  const lost=previous.r.cards.filter(p=>p.busy_dates.includes(q.date)),free=r.cards.filter(p=>p.busy_dates.includes(previous.q.date));
  $('date-change').innerHTML=`<section class="date-change"><strong>Изменилась только дата: ${esc(previous.q.date.split('-').reverse().join('.'))} → ${esc(q.date.split('-').reverse().join('.'))}</strong><p>Подходящих: ${previous.r.eligible} → ${r.eligible}.${lost.length?' Теперь заняты: '+esc(lost.map(p=>p.anon_name).join(', '))+'.':''}${free.length?' На новой дате свободны, а на предыдущей были заняты: '+esc(free.map(p=>p.anon_name).join(', '))+'.':''}</p></section>`;
 }
 current={q,r};renderCards();globalThis.MerekeAI?.sync();
 $('empty-state').hidden=r.cards.length>0;
 if(!r.cards.length){$('empty-title').textContent=r.status==='category_absent'?'В городе нет этой категории':'Кандидаты есть, но условия не совпали';$('empty-description').textContent=r.status==='category_absent'?'В исходном каталоге нет такой категории в выбранном городе. Попробуйте другой город или категорию.':'Все кандидаты исключены по причинам ниже. Измените дату, бюджет или другие условия.';}
 $('increase-budget').hidden=!r.reasons.budget;
 const reasons=Object.entries(r.reasons).filter(([,n])=>n);
 $('diagnostics').innerHTML=r.total?`<section class="diagnostics"><h3>${r.eligible<3?'Почему меньше трёх?':'Как получилась подборка'}</h3><p>В этой категории и городе: ${r.total}. Проходят все условия: ${r.eligible}.${r.eligible>3?' Показываем первые три по правилам ранжирования.':''}</p><div class="reason-list">${reasons.map(([k,n])=>`<span>${labels[k]}: <strong>${n}</strong></span>`).join('')}</div>${reasons.length?'<p class="muted small">У одного профиля может быть несколько причин исключения.</p>':''}</section>`:'';
 previous={q:{...q},r};if($('shortlist-modal').open)renderShortlist();
 return {status:r.status,eligible:r.eligible,ids:r.cards.map(p=>p.id),reasons:r.reasons};
}
function renderCards(){
 const {q,r}=current;
 $('vendor-cards-grid').innerHTML=r.cards.map((p,i)=>{const explanation=api.explanation(p,q,r.cards),isSaved=saved.includes(p.id);
 return `<article class="vendor-card"><div class="card-cover"><span class="rank">Вариант ${i+1}</span><button class="icon-button save-button ${isSaved?'selected':''}" data-save="${esc(p.id)}" aria-label="${isSaved?'Убрать из избранного':'В избранное'}: ${esc(p.anon_name)}" aria-pressed="${isSaved}">${isSaved?'♥':'♡'}</button><span class="category-cover">${esc(q.category)}</span><div class="card-identity"><span class="avatar" aria-hidden="true">${esc(p.anon_name.split(/\s+/).slice(0,2).map(w=>w[0]).join(''))}</span><div><h3>${esc(p.anon_name)}</h3><p>${esc(p.city)}</p></div></div></div><div class="card-body"><div class="card-price"><span>Стоимость за мероприятие</span><strong>от ${api.money(p.price_from_kzt)} ₸</strong></div><div class="why-box"><h4>✦ Почему подходит</h4><p>${esc(explanation.match)}</p></div>${globalThis.MerekeAI?.cardHTML(p.id)||''}${explanation.differences.length?`<div class="differences">${explanation.differences.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}${explanation.matched.length?`<p class="matched-words">Пожелания: ${esc(explanation.matched.join(', '))}</p>`:''}<p class="profile-quote">${esc(explanation.detail)}</p><div class="tags">${factsHTML(p)}${flagHTML(p)}</div></div><div class="card-footer"><button class="profile-button" data-profile="${esc(p.id)}">Полный профиль <span aria-hidden="true">→</span></button></div></article>`;
 }).join('');
}
function openDetailModal(id){
 const p=data.find(x=>x.id===id);if(!p||!current)return;openedId=id;const {q,r}=current;const result=api.recommend([p],q),x=api.explanation(p,q,r.cards);
 $('modal-name').textContent=p.anon_name;$('modal-category-tag').textContent=p.categories.join(' · ');$('modal-price').textContent='от '+api.money(p.price_from_kzt)+' ₸ за мероприятие';
 $('modal-why-text').textContent=result.cards.length?x.match+' '+x.detail:'По текущим параметрам не подходит: '+(result.status==='category_absent'?'другой город или категория':Object.entries(result.reasons).filter(([,n])=>n).map(([k])=>labels[k].toLowerCase()).join(', '))+'.';
 $('modal-stats').innerHTML=`<div><span>Город</span><strong>${esc(p.city)}</strong></div><div><span>Языки</span><strong>${esc(p.languages.join(', '))}</strong></div><div><span>Присутствие</span><strong>${p.max_hours==null?'Не привязано к часам':'До '+p.max_hours+' ч'}</strong></div>`;
 $('modal-bio').textContent=p.description;$('modal-formats-tags').innerHTML=p.event_formats.map(f=>`<span class="tag">${esc(f)}</span>`).join('');$('modal-data-flags').innerHTML=flagHTML(p);updateModalSave();
 if($('shortlist-modal').open)$('shortlist-modal').close();if(!$('detail-modal').open)$('detail-modal').showModal();
}
function updateModalSave(){const b=$('modal-bookmark-btn');b.textContent=saved.includes(openedId)?'Убрать из избранного':'Сохранить в избранное';b.onclick=()=>toggleSaved(openedId);}
function closeDetailModal(){$('detail-modal').close();}
function toggleSaved(id){
 if(!data.some(p=>p.id===id))return;const removing=saved.includes(id);saved=removing?saved.filter(x=>x!==id):[...saved,id];
 let persistent=true;try{localStorage.setItem('mereke_shortlist',JSON.stringify(saved));}catch{persistent=false;}
 updateBadge();renderCards();renderShortlist();if($('detail-modal').open)updateModalSave();
 showToast((removing?'Убрано из избранного':'Добавлено в избранное')+(persistent?'':' — только до закрытия страницы'));
}
function updateBadge(){$('shortlist-badge').textContent=saved.length;$('shortlist-badge').hidden=!saved.length;}
function renderShortlist(){
 $('shortlist-items-container').innerHTML=saved.length?saved.map(id=>{const p=data.find(v=>v.id===id),r=api.recommend([p],current.q);return `<article class="shortlist-item"><div><h3>${esc(p.anon_name)}</h3><p>${esc(p.city)} · от ${api.money(p.price_from_kzt)} ₸</p><span class="shortlist-state">${r.cards.length?'Подходит по текущим условиям':'Не подходит по текущим условиям'}</span><button class="text-button" data-profile="${esc(id)}">Открыть профиль</button></div><button class="icon-button" data-save="${esc(id)}" aria-label="Убрать из избранного: ${esc(p.anon_name)}">×</button></article>`;}).join(''):'<div class="shortlist-empty">Пока здесь пусто.<br>Нажмите ♡ на карточке, чтобы сохранить вариант.</div>';
}
function toggleShortlistModal(){const d=$('shortlist-modal');if(d.open)d.close();else{renderShortlist();d.showModal();}}
function showToast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,2500);}
document.addEventListener('click',event=>{const save=event.target.closest('[data-save]'),profile=event.target.closest('[data-profile]');if(save)toggleSaved(save.dataset.save);if(profile)openDetailModal(profile.dataset.profile);});
for(const id of ['detail-modal','shortlist-modal'])$(id).addEventListener('click',event=>{if(event.target!==$(id))return;const r=$(id).getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$(id).close();});
demos.forEach(([label,q])=>{const b=document.createElement('button');b.textContent=label;b.onclick=()=>preset(q);$('demo-buttons').append(b);});
preset(dense);updateBadge();
if(document.modelContext?.registerTool){const lifecycle=new AbortController();Promise.resolve(document.modelContext.registerTool({name:'find_contractors',title:'Подбор Mereke',description:'Проверить условия и обновить подборку подрядчиков на странице.',inputSchema:{type:'object',properties:{city:{type:'string'},date:{type:'string'},event:{type:'string'},category:{type:'string'},budget:{type:'number'},hours:{type:'number'},language:{type:'string'},wishes:{type:'string',maxLength:500}},required:['city','date','event','category','budget'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:input=>{const q={hours:'',language:'',wishes:'',...input};api.validate(q);for(const [key,values] of [['city',data.map(p=>p.city)],['event',data.flatMap(p=>p.event_formats)],['category',data.flatMap(p=>p.categories)]])if(!values.includes(q[key]))throw new Error('Неизвестное значение: '+key);if(q.language&&!data.some(p=>p.languages.includes(q.language)))throw new Error('Неизвестный язык');return preset(q);}},{signal:lifecycle.signal})).catch(()=>{});window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}
