(function(root) {
  'use strict';
  const money = value => new Intl.NumberFormat('ru-RU').format(value);
  const normalize = text => String(text || '').toLowerCase().replace(/ё/g,'е');
  const words = text => normalize(text).match(/[а-яa-z]+/g) || [];
  const stop = new Set(['нужен','нужна','нужны','нужно','хочу','хочется','ищу','ведущий','ведущего','фотограф','фотографа','чтобы','очень','пожалуйста','мероприятие','мероприятия','свадьба','свадьбу','корпоратив']);
  function preferences(text) {
    const tokens=words(text), terms=[];
    for(let i=0;i<tokens.length;i++){
      const token=tokens[i];
      if(['без','не'].includes(token) && tokens[i+1]){terms.push({label:token+' '+tokens[i+1],phrase:true,stem:token+' '+tokens[++i]});continue;}
      if(token.length<4 || stop.has(token)) continue;
      const stem=token.replace(/(иями|ями|ами|ого|ему|ому|ими|ыми|ией|ия|ию|ии|ый|ий|ой|ая|яя|ое|ее|ые|ие|ом|ем|ов|ев|ам|ям|ах|ях|у|ю|а|я|ы|и)$/,'');
      if(stem.length>=4) terms.push({label:token,stem,phrase:false});
    }
    return terms.filter((t,i,a)=>a.findIndex(x=>x.stem===t.stem)===i).slice(0,20);
  }
  function wishMatches(description,wishes) {
    const text=normalize(description), tokens=words(description);
    return preferences(wishes).filter(t=>t.phrase?text.includes(t.stem):tokens.some((word,i)=>word.startsWith(t.stem)&&!['не','без'].includes(tokens[i-1]))).map(t=>t.label);
  }
  function validate(q) {
    if (!q || !['city','date','event','category'].every(k => typeof q[k] === 'string' && q[k].trim())) throw new Error('Заполните город, дату, формат и категорию.');
    if (!/^2026-\d{2}-\d{2}$/.test(q.date) || q.date < '2026-09-23' || q.date > '2026-12-31' || new Date(q.date).toISOString().slice(0,10) !== q.date) throw new Error('Выберите дату с 23 сентября по 31 декабря 2026 года.');
    if (!Number.isFinite(Number(q.budget)) || Number(q.budget) <= 0) throw new Error('Укажите бюджет больше нуля.');
    if (q.hours !== '' && q.hours != null && (!Number.isFinite(Number(q.hours)) || Number(q.hours) <= 0)) throw new Error('Длительность должна быть больше нуля.');
    if(q.wishes != null && (typeof q.wishes!=='string'||q.wishes.length>500)) throw new Error('Пожелания: не более 500 символов.');
  }
  function recommend(data, q) {
    validate(q);
    const pool = data.filter(p => p.city === q.city && p.categories.includes(q.category));
    const reasons = {busy:0,budget:0,format:0,language:0,hours:0};
    const excluded = [];
    const eligible = pool.filter(p => {
      const why = [];
      if (p.busy_dates.includes(q.date)) why.push('busy');
      if (p.price_from_kzt > Number(q.budget)) why.push('budget');
      if (!p.event_formats.includes(q.event)) why.push('format');
      if (q.language && !p.languages.includes(q.language)) why.push('language');
      if (q.hours && p.max_hours != null && p.max_hours < Number(q.hours)) why.push('hours');
      why.forEach(k => reasons[k]++);
      if (why.length) excluded.push({id:p.id,name:p.anon_name,reasons:why});
      return !why.length;
    });
    const score = p => (p.description.toLowerCase().includes(q.event.toLowerCase()) ? 1 : 0);
    eligible.sort((a,b) => wishMatches(b.description,q.wishes).length-wishMatches(a.description,q.wishes).length || score(b)-score(a) || a.price_from_kzt-b.price_from_kzt || (a.id<b.id?-1:a.id>b.id?1:0));
    return {status:!pool.length?'category_absent':!eligible.length?'no_match':'matched',total:pool.length,eligible:eligible.length,reasons,excluded,cards:eligible.slice(0,3)};
  }
  function explanation(p,q,peers=[]) {
    const parts = [`На ${q.date.split('-').reverse().join('.')} свободен по календарю`, `берёт формат «${q.event}»`, `цена от ${money(p.price_from_kzt)} ₸ при бюджете ${money(Number(q.budget))} ₸`];
    if(q.language) parts.push(`работает на языке: ${q.language}`);
    if(q.hours && p.max_hours != null) parts.push(`лимит ${p.max_hours} ч покрывает ваши ${q.hours} ч`);
    if(q.hours && p.max_hours == null) parts.push('услуга не привязана к часам присутствия');
    const others=peers.filter(x=>x.id!==p.id).map(x=>new Set(words(x.description)));
    const sentences=p.description.replace(/\s+/g,' ').trim().split(/(?<=[.!?])\s+/).filter(s=>s.length>25);
    const strength=s=>wishMatches(s,q.wishes).length*100+Math.min(words(s).filter(w=>w.length>5 && others.every(set=>!set.has(w))).length,12);
    const sentence = sentences.map((s,i)=>({s,i,score:strength(s)})).sort((a,b)=>b.score-a.score||a.i-b.i)[0]?.s || p.description;
    const excerpt = sentence.length > 220 ? sentence.slice(0,217).replace(/\s+\S*$/,'')+'…' : sentence;
    const matched=wishMatches(p.description,q.wishes);
    const differences=[];
    if(peers.length>1 && peers.filter(x=>x.price_from_kzt<=p.price_from_kzt).length===1) differences.push('Самая низкая стартовая цена в этой подборке');
    if(peers.length>1 && p.max_hours!=null && peers.every(x=>x.id===p.id||(x.max_hours!=null&&x.max_hours<p.max_hours))) differences.push(`Наибольший лимит присутствия в подборке: ${p.max_hours} ч`);
    const exclusive=p.languages.filter(lang=>peers.length>1&&peers.every(x=>x.id===p.id||!x.languages.includes(lang)));
    if(exclusive.length) differences.push('Только в этой карточке: '+exclusive.join(', '));
    return {match:parts.join('; ')+'.',detail:'Из описания: «'+excerpt+'»',matched,differences};
  }
  const api={recommend,validate,explanation,money,wishMatches}; root.EventMatch=api;
  if(typeof module!=='undefined') module.exports=api;
})(globalThis);
