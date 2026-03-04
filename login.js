document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.querySelector('.login-form');
    
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault(); 
            // Autoriza a sessão
            localStorage.setItem('isLoggedIn', 'true'); 
            // Redireciona para a IA (Página inicial)
            window.location.href = 'index.html'; 
        });
    }
});