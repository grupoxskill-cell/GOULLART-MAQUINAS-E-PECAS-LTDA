const form = document.getElementById('form');
const summary = document.getElementById('resumo');
const modality = document.getElementById('modalidade');
const whatsapp = document.getElementById('whatsapp');
const teamNumber = '5562999427276';

function editRequest() {
  form.hidden = false;
  summary.hidden = true;
  whatsapp.removeAttribute('href');
  document.body.classList.remove('summarizing');
}

function renderDetails(list, entries) {
  list.replaceChildren();
  for (const [label, value] of entries) {
    const term = document.createElement('dt');
    term.textContent = label;
    const description = document.createElement('dd');
    description.textContent = value;
    list.append(term, description);
  }
}

for (const link of document.querySelectorAll('[data-route]')) {
  link.addEventListener('click', () => {
    editRequest();
    modality.value = link.dataset.route;
  });
}

form.addEventListener('submit', event => {
  event.preventDefault();
  const entries = [];
  for (const [label, rawValue] of new FormData(form)) {
    const value = rawValue.trim();
    const input = form.elements.namedItem(label);
    if (!value && input.required) {
      input.value = '';
      input.reportValidity();
      return;
    }
    if (value) entries.push([label, value]);
  }

  const message = [
    'Olá, Equipe Goullart Agro Brasil! Quero orientação para comprar uma máquina.',
    ...entries.map(([label, value]) => label + ': ' + value)
  ].join('\n');
  const destination = new URL('https://wa.me/' + teamNumber);
  destination.searchParams.set('text', message);
  whatsapp.href = destination.href;
  renderDetails(summary.querySelector('dl'), entries);
  renderDetails(document.querySelector('#printSheet dl'), entries);
  form.hidden = true;
  summary.hidden = false;
  document.body.classList.add('summarizing');
  document.getElementById('sumtitle').focus();
});

document.getElementById('edit').addEventListener('click', () => {
  editRequest();
  modality.focus();
});
document.getElementById('print').addEventListener('click', () => window.print());
form.hidden = false;
