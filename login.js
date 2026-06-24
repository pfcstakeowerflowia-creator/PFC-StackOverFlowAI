document.addEventListener("DOMContentLoaded", () => {
    // Mantém o estado do contraste
    if (localStorage.getItem('highContrast') === 'true') {
        document.body.classList.add('high-contrast');
    }

    const loginForm = document.querySelector('.login-form');
    
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault(); 
            localStorage.setItem('isLoggedIn', 'true'); 
            window.location.href = 'index.html'; 
        });
    }
});