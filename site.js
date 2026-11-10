const form = document.querySelector('#quote-form');
const quoteNote = document.querySelector('#form-note');
const quoteButton = form.querySelector('button[type="submit"]');
// GitHub Pages serves the public site without the Node.js quote endpoint.
form.hidden = window.location.hostname === 'fordsupplies.github.io';

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (quoteButton.disabled) return;

  quoteButton.disabled = true;
  quoteNote.textContent = 'Envoi de la demande en cours…';

  try {
    const response = await fetch('/api/soumission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(form)))
    });

    if (!response.ok) throw new Error('Quote delivery failed');

    form.reset();
    quoteNote.textContent = 'Votre demande a bien été envoyée. Merci!';
  } catch {
    quoteNote.textContent = 'Votre demande n’a pas pu être envoyée. Réessayez ou contactez-nous par téléphone.';
  } finally {
    quoteButton.disabled = false;
  }
});



const viewer = document.querySelector('#photo-viewer');
const thumbnails = [...document.querySelectorAll('.gallery-photo')];
const viewerImage = viewer.querySelector('.viewer-image');
const caption = viewer.querySelector('#photo-caption');
const count = viewer.querySelector('#photo-count');
let currentPhoto = 0;

function showPhoto(index) {
  currentPhoto = (index + thumbnails.length) % thumbnails.length;
  const thumbnail = thumbnails[currentPhoto];
  viewerImage.src = thumbnail.href;
  viewerImage.alt = thumbnail.querySelector('img').alt;
  caption.textContent = thumbnail.closest('figure').querySelector('figcaption').textContent;
  count.textContent = (currentPhoto + 1) + ' / ' + thumbnails.length;
}

thumbnails.forEach((thumbnail, index) => {
  thumbnail.addEventListener('click', (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    showPhoto(index);
    viewer.showModal();
  });
});

viewer.querySelectorAll('[data-step]').forEach((button) => {
  button.addEventListener('click', () => showPhoto(currentPhoto + Number(button.dataset.step)));
});

viewer.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    showPhoto(currentPhoto + (event.key === 'ArrowLeft' ? -1 : 1));
  }
});

let swipeStart = null;

viewer.addEventListener('pointerdown', (event) => {
  if (event.pointerType !== 'touch') return;
  swipeStart = event.isPrimary && event.target === viewerImage
    ? { id: event.pointerId, x: event.clientX, y: event.clientY }
    : null;
});

viewerImage.addEventListener('pointerup', (event) => {
  if (event.pointerId !== swipeStart?.id) return;

  const deltaX = event.clientX - swipeStart.x;
  const deltaY = event.clientY - swipeStart.y;
  swipeStart = null;

  if (Math.abs(deltaX) >= 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
    showPhoto(currentPhoto + (deltaX < 0 ? 1 : -1));
  }
});

viewerImage.addEventListener('pointercancel', () => { swipeStart = null; });
viewer.addEventListener('close', () => { swipeStart = null; });
