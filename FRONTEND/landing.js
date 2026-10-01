/* ==========================================
   Al Marakish Library - Landing Page Script
   ========================================== */

document.addEventListener('DOMContentLoaded', function() {
    
    // ==========================================
    // Navbar Scroll Effect
    // ==========================================
    const navbar = document.querySelector('.navbar');
    let lastScroll = 0;
    
    window.addEventListener('scroll', function() {
        const currentScroll = window.pageYOffset;
        
        if (currentScroll > 50) {
            navbar.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.1)';
        } else {
            navbar.style.boxShadow = 'none';
        }
        
        lastScroll = currentScroll;
    });
    
    // ==========================================
    // Smooth Scroll for Navigation Links
    // ==========================================
    const navLinks = document.querySelectorAll('a[href^="#"]');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            // Skip if it's just '#'
            if (href === '#') {
                e.preventDefault();
                return;
            }
            
            const targetId = href.substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                e.preventDefault();
                
                const navbarHeight = navbar.offsetHeight;
                const targetPosition = targetElement.offsetTop - navbarHeight - 20;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
                
                // Update active state
                document.querySelectorAll('.nav-link').forEach(link => {
                    link.classList.remove('active');
                });
                this.classList.add('active');
            }
        });
    });
    
    // ==========================================
    // Mobile Menu Toggle
    // ==========================================
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const navLinksContainer = document.querySelector('.nav-links');
    
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', function() {
            navLinksContainer.classList.toggle('active');
            this.classList.toggle('active');
        });
        
        // Close menu when clicking on a link
        const mobileNavLinks = navLinksContainer.querySelectorAll('.nav-link');
        mobileNavLinks.forEach(link => {
            link.addEventListener('click', function() {
                navLinksContainer.classList.remove('active');
                mobileMenuToggle.classList.remove('active');
            });
        });
    }
    
    // ==========================================
    // Animated Counter for Stats
    // ==========================================
    const statNumbers = document.querySelectorAll('.stat-number');
    let animated = false;
    
    function animateCounters() {
        if (animated) return;
        
        const statsSection = document.querySelector('.stats');
        const sectionPosition = statsSection.getBoundingClientRect().top;
        const screenPosition = window.innerHeight;
        
        if (sectionPosition < screenPosition - 100) {
            animated = true;
            
            statNumbers.forEach(stat => {
                const target = parseInt(stat.getAttribute('data-count'));
                const duration = 2000; // 2 seconds
                const increment = target / (duration / 16); // 60fps
                let current = 0;
                
                const counter = setInterval(() => {
                    current += increment;
                    
                    if (current >= target) {
                        stat.textContent = target + (stat.nextElementSibling.textContent.includes('Rate') ? '%' : '+');
                        clearInterval(counter);
                    } else {
                        stat.textContent = Math.floor(current) + (stat.nextElementSibling.textContent.includes('Rate') ? '%' : '+');
                    }
                }, 16);
            });
        }
    }
    
    window.addEventListener('scroll', animateCounters);
    animateCounters(); // Check on load
    
    // ==========================================
    // Intersection Observer for Fade-in Animations
    // ==========================================
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe elements for animation
    const animateOnScroll = document.querySelectorAll('.service-card, .feature-item, .stat-card, .contact-item');
    
    animateOnScroll.forEach(element => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(30px)';
        element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(element);
    });
    
    // ==========================================
    // Active Section Highlight in Navigation
    // ==========================================
    const sections = document.querySelectorAll('section[id]');
    
    function highlightNavigation() {
        const scrollPosition = window.pageYOffset;
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop - navbar.offsetHeight - 100;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');
            
            if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                document.querySelectorAll('.nav-link').forEach(link => {
                    link.classList.remove('active');
                    
                    if (link.getAttribute('href') === `#${sectionId}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }
    
    window.addEventListener('scroll', highlightNavigation);
    
    // ==========================================
    // Contact Form Handler - WhatsApp & Email
    // ==========================================
    const contactForm = document.querySelector('.contact-form');
    
    if (contactForm) {
        // Track which button triggered the submit
        let submitAction = 'whatsapp';
        
        // Add click listeners to buttons to update the action
        const actionButtons = contactForm.querySelectorAll('button[type="submit"]');
        actionButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                submitAction = this.getAttribute('data-action');
            });
        });

        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Get form data
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const subject = document.getElementById('subject').value;
            const message = document.getElementById('message').value;
            
            // Use the tracked action
            const action = submitAction || 'whatsapp';
            
            if (action === 'email') {
                // Email Logic
                const mailtoLink = `mailto:almarakishlibrary@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`)}`;
                window.location.href = mailtoLink;
            } else {
                // WhatsApp Logic (default)
                const phoneNumber = '919847411637'; // Library contact number
                const text = `New Message from Al Marakish Library Website\n\nName: ${name}\nEmail: ${email}\nSubject: ${subject}\nMessage: ${message}`;
                const encodedText = encodeURIComponent(text);
                const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedText}`;
                window.open(whatsappUrl, '_blank');
            }
            
            // Form content is preserved so user can edit or choose another method
            // this.reset();
        });
    }
    
    // ==========================================
    // Parallax Effect for Hero Background
    // ==========================================
    const heroBackground = document.querySelector('.hero-background');
    
    window.addEventListener('scroll', function() {
        const scrolled = window.pageYOffset;
        const parallax = scrolled * 0.5;
        
        if (heroBackground && scrolled < window.innerHeight) {
            heroBackground.style.transform = `translateY(${parallax}px)`;
        }
    });
    
    // ==========================================
    // Add Hover Sound Effects (Optional)
    // ==========================================
    const buttons = document.querySelectorAll('.btn');
    const cards = document.querySelectorAll('.service-card, .stat-card, .feature-item');
    
    // Add subtle scale effect on hover
    cards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px) scale(1.02)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
    
    // ==========================================
    // Lazy Loading for Images (if any are added)
    // ==========================================
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.add('loaded');
                    observer.unobserve(img);
                }
            });
        });
        
        const images = document.querySelectorAll('img[data-src]');
        images.forEach(img => imageObserver.observe(img));
    }
    
    // ==========================================
    // Floating Animation for Hero Cards
    // ==========================================
    const floatingCards = document.querySelectorAll('.floating-card');
    
    floatingCards.forEach((card, index) => {
        // Add random delay to each card's animation
        card.style.animationDelay = `${index * 0.5}s`;
        
        // Add interactive tilt effect
        card.addEventListener('mousemove', function(e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const rotateX = (y - centerY) / 10;
            const rotateY = (centerX - x) / 10;
            
            this.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-20px)`;
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'perspective(1000px) rotateX(0) rotateY(0)';
        });
    });
    
    // ==========================================
    // Progressive Enhancement: Add cursor effects
    // ==========================================
    const cursor = document.createElement('div');
    cursor.classList.add('custom-cursor');
    document.body.appendChild(cursor);
    
    // Style the custom cursor
    cursor.style.cssText = `
        position: fixed;
        width: 20px;
        height: 20px;
        border: 2px solid hsl(180, 45%, 25%);
        border-radius: 50%;
        pointer-events: none;
        z-index: 9999;
        transition: all 0.1s ease;
        display: none;
    `;
    
    // Only show on larger screens
    if (window.innerWidth > 768) {
        cursor.style.display = 'block';
        
        document.addEventListener('mousemove', function(e) {
            cursor.style.left = e.clientX - 10 + 'px';
            cursor.style.top = e.clientY - 10 + 'px';
        });
        
        // Enlarge cursor on interactive elements
        const interactiveElements = document.querySelectorAll('a, button, .btn');
        
        interactiveElements.forEach(element => {
            element.addEventListener('mouseenter', function() {
                cursor.style.transform = 'scale(1.5)';
                cursor.style.backgroundColor = 'rgba(180, 45%, 25%, 0.1)';
            });
            
            element.addEventListener('mouseleave', function() {
                cursor.style.transform = 'scale(1)';
                cursor.style.backgroundColor = 'transparent';
            });
        });
    }
    
    // ==========================================
    // Page Load Animation
    // ==========================================
    window.addEventListener('load', function() {
        document.body.style.opacity = '0';
        document.body.style.transition = 'opacity 0.5s ease';
        
        setTimeout(function() {
            document.body.style.opacity = '1';
        }, 100);
    });
    
    console.log('🎉 Al Marakish Library - Landing page loaded successfully!');
});
