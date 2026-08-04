// Hamburger toggle
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('navLinks');

hamburger.addEventListener('click', () => {
navLinks.classList.toggle('open');
});

// Close nav on link click (mobile)
navLinks.querySelectorAll('a').forEach(link => {
link.addEventListener('click', () => navLinks.classList.remove('open'));
});

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
anchor.addEventListener('click', function(e) {
    const href = this.getAttribute('href');
    if (href === '#') return;
    const target = document.querySelector(href);
    if (target) {
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
});
});

// Animate progress bar on scroll
const barFill = document.querySelector('.mockup-bar-fill');
const observer = new IntersectionObserver(entries => {
entries.forEach(entry => {
    if (entry.isIntersecting) {
    entry.target.style.width = '72%';
    }
});
}, { threshold: 0.3 });

if (barFill) {
barFill.style.width = '0%';
barFill.style.transition = 'width 1.2s cubic-bezier(0.4,0,0.2,1)';
observer.observe(barFill);
}

// Reveal feature cards on scroll
const cards = document.querySelectorAll('.feature-card, .about-stat-card');
const revealObserver = new IntersectionObserver((entries) => {
entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
    entry.target.style.transitionDelay = `${(Array.from(cards).indexOf(entry.target) % 4) * 60}ms`;
    entry.target.style.opacity = '1';
    entry.target.style.transform = 'translateY(0)';
    revealObserver.unobserve(entry.target);
    }
});
}, { threshold: 0.1 });

cards.forEach(card => {
card.style.opacity = '0';
card.style.transform = 'translateY(22px)';
card.style.transition = 'opacity 0.45s ease, transform 0.45s ease, box-shadow 0.22s, border-color 0.22s';
revealObserver.observe(card);
});