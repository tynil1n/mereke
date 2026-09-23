const assert=require('node:assert/strict');
require('./dist/data.js');const {recommend,explanation}=require('./dist/engine.js');const data=globalThis.CONTRACTORS;
assert.equal(data.length,66);assert.equal(new Set(data.map(p=>p.id)).size,66);
const base={city:'Алматы',category:'Ведущий',date:'2026-10-10',event:'корпоратив',budget:1000000,hours:'',language:''};
assert.equal(recommend(data,{...base,budget:1}).status,'no_match');
assert.equal(recommend(data,{...base,city:'Зарубежье',category:'Флорист'}).status,'category_absent');
assert.throws(()=>recommend(data,{...base,date:'2026-02-30'}));assert.throws(()=>recommend(data,{...base,budget:0}));
let queries=0;const begin=performance.now();
for(const city of new Set(data.map(p=>p.city)))for(const category of new Set(data.flatMap(p=>p.categories)))for(const date of ['2026-09-23','2026-10-10','2026-11-14','2026-12-31']){
 const q={...base,city,category,date,language:'русский',hours:5};const r=recommend(data,q);
 assert.deepEqual(r,recommend(data,q));assert.ok(r.cards.length<=3);
 for(const p of r.cards){assert.equal(p.city,city);assert.ok(p.categories.includes(category));assert.ok(!p.busy_dates.includes(date));assert.ok(p.price_from_kzt<=q.budget);assert.ok(p.event_formats.includes(q.event));assert.ok(p.languages.includes(q.language));assert.ok(p.max_hours===null||p.max_hours>=5);const x=explanation(p,q);assert.ok(x.match.includes('₸'));assert.ok(x.detail.length>25);}
 queries++;
}
const p=data.find(p=>p.max_hours===null);const free=Array.from({length:31},(_,i)=>`2026-10-${String(i+1).padStart(2,'0')}`).find(d=>!p.busy_dates.includes(d));
assert.equal(recommend([p],{city:p.city,category:p.categories[0],event:p.event_formats[0],date:free,budget:p.price_from_kzt,hours:99,language:''}).cards.length,1);
const busy=p.busy_dates[0];assert.equal(recommend([p],{city:p.city,category:p.categories[0],event:p.event_formats[0],date:busy,budget:p.price_from_kzt,hours:'',language:''}).status,'no_match');
assert.equal(recommend([p],{city:p.city,category:p.categories[0],event:p.event_formats[0],date:free,budget:p.price_from_kzt-1,hours:'',language:''}).status,'no_match');
const variants=new Set(Array.from({length:31},(_,i)=>recommend(data,{...base,date:`2026-10-${String(i+1).padStart(2,'0')}`}).cards.map(p=>p.id).join(',')));assert.ok(variants.size>1);
console.log(`PASS: ${queries} real-data requests, repeatability, all filters, price boundaries, null hours, date changes. ${Math.round(performance.now()-begin)} ms`);
const demo={...base,date:'2026-10-15',hours:6,language:'русский'};
assert.equal(recommend(data,demo).eligible,6);
assert.equal(recommend(data,{...demo,date:'2026-10-16'}).eligible,4);
const florist={...demo,category:'Флорист',event:'свадьба',budget:300000,hours:'',language:''};
assert.equal(recommend(data,florist).eligible,2);
assert.equal(recommend(data,{...florist,budget:100000}).status,'no_match');
assert.equal(recommend(data,{...florist,city:'Астана',category:'Декоратор'}).status,'category_absent');
const {wishMatches}=require('./dist/engine.js');
assert.deepEqual(wishMatches('Импровизация и современные интерактивы.','импровизация и интерактивы'),['импровизация','интерактивы']);
assert.deepEqual(wishMatches('Постановка и портреты.','без постановки'),[]);
assert.deepEqual(wishMatches('Работаем без постановки.','без постановки'),['без постановки']);
assert.deepEqual(wishMatches('Без импровизации.','импровизация'),[]);
const template={...data[0],city:demo.city,categories:[demo.category],event_formats:[demo.event],languages:['русский'],max_hours:8,busy_dates:[]};
const fixtures=[{...template,id:'A',price_from_kzt:100,description:'Классический формат и работа по сценарию.'},{...template,id:'B',price_from_kzt:200,description:'Импровизация и интерактивы для гостей.'},{...template,id:'C',price_from_kzt:50,description:'Импровизация и интерактивы для гостей.',busy_dates:[demo.date]}];
assert.equal(recommend(fixtures,demo).cards[0].id,'A');
const wished={...demo,wishes:'импровизация и интерактивы'};
const ranked=recommend(fixtures,wished);
assert.deepEqual(ranked.cards.map(p=>p.id),['B','A']);
assert.deepEqual(ranked,recommend(fixtures,wished));
assert.equal(recommend(fixtures,{...wished,budget:150}).cards[0].id,'A');
assert.throws(()=>recommend(data,{...demo,wishes:'x'.repeat(501)}));
for(const card of ranked.cards){const exp=explanation(card,wished,ranked.cards);if(exp.differences.some(x=>x.includes('Самая низкая')))assert.equal(card.id,'A');}
const cards=recommend(data,demo).cards;assert.equal(new Set(cards.map(p=>explanation(p,demo,cards).detail)).size,cards.length);
console.log('PASS: shared-chat demo counts, preference ordering, hard constraints, simple negation, distinct evidence, comparison truthfulness.');
