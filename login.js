document.addEventListener("DOMContentLoaded", () => {
    // 1. Mantém o estado do Alto Contraste se ativo
    if (localStorage.getItem('highContrast') === 'true') {
        document.body.classList.add('high-contrast');
    }

    const loginForm = document.querySelector('.login-form');
    const submitBtn = document.getElementById('btn-submit-login');
    
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault(); 
            
            const emailInput = document.getElementById('email');
            const emailValor = emailInput ? emailInput.value.trim() : '';

            // Formata o nome do usuário com base no e-mail (ex: aluno2026@ifpr.edu -> Aluno2026)
            let nomeExibicao = "Aluno PFC Logado";
            if (emailValor.includes('@')) {
                const prefixo = emailValor.split('@')[0];
                nomeExibicao = prefixo.charAt(0).toUpperCase() + prefixo.slice(1);
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Autenticando...';
            }

            // Salva a sessão e o nome dinâmico no navegador
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userName', nomeExibicao);

            setTimeout(() => {
                window.location.href = 'index.html'; 
            }, 600);
        });
    }
});