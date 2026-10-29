(() => {
 'use strict';
 const root = document.getElementById('goullart-contact');
 if (!root) return;
 const panel = document.getElementById('goullart-contact-panel');
 const launcher = document.getElementById('goullart-contact-launcher');
 const form = document.getElementById('goullart-contact-form');
 const message = document.getElementById('goullart-contact-message');
 const close = root.querySelector('.goullart-contact-close');
 const sessionKey = 'goullart-contact-greeted-v1';
 let interacted = false;
 const remember = () => { try { sessionStorage.setItem(sessionKey, '1'); } catch {} };
 function setOpen(open, focus = false) {
  panel.hidden = !open;
  launcher.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('goullart-contact-open', open);
  if (open) remember();
  if (!open) document.body.classList.remove('goullart-contact-keyboard');
  if (focus) (open ? message : launcher).focus({preventScroll:true});
 }
 launcher.addEventListener('click', event => {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  interacted = true;
  setOpen(panel.hidden, true);
 });
 close.addEventListener('click', () => { interacted = true; remember(); setOpen(false, true); });
 document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !panel.hidden) { interacted = true; setOpen(false, root.contains(document.activeElement)); }
 });
 message.addEventListener('input', () => message.setCustomValidity(''));
 form.addEventListener('submit', event => {
  if (!message.value.trim()) {
   event.preventDefault();
   message.setCustomValidity('Escreva sua resposta para continuar no WhatsApp.');
   message.reportValidity();
   return;
  }
  message.value = message.value.trim();
  interacted = true;
  remember();
  // Native GET opens WhatsApp with the visitor's text. It does not send it.
 });
 let greeted = false;
 try { greeted = sessionStorage.getItem(sessionKey) === '1'; } catch {}
 if (!greeted) window.setTimeout(() => {
  const busy = document.activeElement?.matches('input,textarea,select,[contenteditable=true]') || document.querySelector('dialog[open],[aria-modal="true"]:not([hidden])');
  if (!interacted && !busy && !document.hidden) setOpen(true);
 }, 7000);
 let walking = false;
 window.addEventListener('scroll', () => {
  if (walking || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  walking = true;
  launcher.classList.add('is-scrolling');
  window.setTimeout(() => { walking = false; launcher.classList.remove('is-scrolling'); }, 700);
 }, {passive:true});
 const viewport = window.visualViewport;
 function fitKeyboard() {
  if (!viewport) return;
  const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
  root.style.setProperty('--goullart-keyboard-inset', `${inset}px`);
  root.style.setProperty('--goullart-visual-height', `${viewport.height}px`);
  document.body.classList.toggle('goullart-contact-keyboard', !panel.hidden && document.activeElement === message && inset > 120);
 }
 viewport?.addEventListener('resize', fitKeyboard);
 viewport?.addEventListener('scroll', fitKeyboard);
 message.addEventListener('focus', fitKeyboard);
 message.addEventListener('blur', () => window.setTimeout(fitKeyboard, 100));
})();
