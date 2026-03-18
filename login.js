document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.querySelector('.login-form');
    
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault(); 
            localStorage.setItem('isLoggedIn', 'true'); 
            window.location.href = 'index.html'; 
        });
    }
});