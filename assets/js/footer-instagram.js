document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('footer-instagram-grid');
  if (!grid) return;

  const curatedImages = [
    '/assets/img/IMG_6281.jpeg',
    '/assets/img/IMG_7226.jpeg',
    '/assets/img/IMG_9817.jpeg',
    '/assets/img/IMG_9863.jpeg'
  ];

  const cards = Array.from(grid.querySelectorAll('.footerInstagramCard img'));
  cards.forEach((img, index) => {
    if (curatedImages[index]) img.src = curatedImages[index];
  });
});
document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('footer-instagram-grid');
  if (!grid) return;

  const curatedImages = [
    '/assets/img/IMG_6281.jpeg',
    '/assets/img/IMG_7226.jpeg',
    '/assets/img/IMG_9817.jpeg',
    '/assets/img/IMG_9863.jpeg'
  ];

  const cards = Array.from(grid.querySelectorAll('.footerInstagramCard img'));
  cards.forEach((img, index) => {
    if (curatedImages[index]) img.src = curatedImages[index];
    img.alt = 'Casas da Vila';
  });
});