'use strict';
(() => {
  const button = document.getElementById('ai-explain');
  const status = document.getElementById('ai-status');
  let explanations = new Map(), controller = null, version = 0;
  const idle = 'Карточки отобраны по условиям. ИИ поможет сравнить особенности и учтёт ваши пожелания в объяснении.';
  function sync() { button.disabled = !current?.r.cards.length; }
  function reset() {
    version++; controller?.abort(); controller = null;
    explanations.clear();
    button.textContent = '✦ Объяснить выбор с ИИ';
    button.removeAttribute('aria-busy'); status.textContent = idle;
    status.dataset.state = 'idle'; sync();
  }
  function cardHTML(id) {
    const item = explanations.get(id);
    if (!item) return '';
    return `<section class="ai-explanation"><h4>✦ Объяснение OpenAI</h4><p>${esc(item.reason)}</p><blockquote><span>Основание в профиле</span>«${esc(item.evidence)}»</blockquote>${item.caveat ? `<p class="ai-caveat">Что уточнить: ${esc(item.caveat)}</p>` : ''}</section>`;
  }
  globalThis.MerekeAI = { reset, sync, cardHTML };
  button.addEventListener('click', async () => {
    const filtered = applyFilters();
    if (filtered.status === 'invalid' || !current.r.cards.length) return;
    if (location.protocol === 'file:') {
      status.textContent = 'Открыта локальная копия без сервера. Подбор по условиям работает; ИИ доступен на опубликованном сайте.';
      status.dataset.state = 'fallback'; return;
    }
    const requestVersion = ++version;
    const snapshot = JSON.stringify(query());
    controller = new AbortController();
    const localController = controller;
    const timeout = setTimeout(() => localController.abort(), 45000);
    button.disabled = true; button.textContent = 'Готовим объяснения…'; button.setAttribute('aria-busy', 'true');
    status.dataset.state = 'loading'; status.textContent = 'ИИ изучает описания выбранных подрядчиков. Обычно это занимает несколько секунд.';
    try {
      const response = await fetch('/api/recommend', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: snapshot, signal: localController.signal
      });
      if (requestVersion !== version || snapshot !== JSON.stringify(query())) return;
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('no_server');
      const result = await response.json();
      if (requestVersion !== version || snapshot !== JSON.stringify(query())) return;
      if (result.mode === 'openai' && response.ok) {
        const ids = current.r.cards.map(p => p.id);
        if (!Array.isArray(result.explanations) || result.explanations.length !== ids.length ||
          new Set(result.explanations.map(x => x.id)).size !== ids.length ||
          result.explanations.some(x => !ids.includes(x.id) || !['reason','evidence','caveat'].every(k => typeof x[k] === 'string'))) throw new Error('bad_response');
        explanations = new Map(result.explanations.map(x => [x.id, x]));
        renderCards();
        if (document.getElementById('detail-modal').open) openDetailModal(openedId);
        status.dataset.state = 'success';
        status.textContent = 'Объяснения OpenAI готовы. Цены и условия взяты из каталога; пожелания, требующие уточнения, отмечены в карточках.';
      } else {
        const messages = {
          not_configured: 'ИИ ещё не подключён к этому сайту. Показана подборка по условиям.',
          rate_limit: 'Много запросов к ИИ. Попробуйте через 10 минут; подборка по условиям уже готова.',
          busy: 'ИИ обрабатывает другие запросы. Попробуйте немного позже.',
          timeout: 'ИИ не успел ответить. Показана подборка по условиям; можно повторить запрос.'
        };
        status.dataset.state = 'fallback';
        status.textContent = messages[result.reason] || 'ИИ временно недоступен. Показана подборка по условиям; попробуйте позже.';
      }
    } catch (err) {
      if (requestVersion !== version) return;
      status.dataset.state = 'fallback';
      status.textContent = err.message === 'no_server'
        ? 'На этой версии сайта нет подключения к ИИ. Подборка по условиям работает.'
        : 'Не удалось получить ответ ИИ. Подборка по условиям сохранена; попробуйте ещё раз.';
    } finally {
      clearTimeout(timeout);
      if (requestVersion === version) {
        controller = null; button.textContent = explanations.size ? '✦ Обновить объяснения' : '✦ Объяснить выбор с ИИ';
        button.removeAttribute('aria-busy'); sync();
      }
    }
  });
  // Invalidate in-flight answers immediately, even before an input loses focus.
  document.getElementById('criteria-content').addEventListener('input', () => {
    reset(); if (current) renderCards();
  });
  reset();
})();
