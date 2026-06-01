document.addEventListener("DOMContentLoaded", () => {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (!isLoggedIn) { window.location.href = 'login.html'; return; }

    const askForm = document.querySelector('.ask-form');
    if (askForm) {
        askForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const novoPost = {
                titulo: document.getElementById('ask-title').value,
                desc: document.getElementById('ask-desc').value,
                tags: ["RAG-Database", "MongoDB"],
                author: "Admin Root (Local Master DB)"
            };

            try {
                // Chamada para o backend
                const response = await fetch('https://pfc-stackoverflowai.onrender.com/api/posts',  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(novoPost)
                });

                if (response.ok) {
                    alert("✅ Salvo com sucesso no MongoDB!");
                    window.location.href = 'forum.html';
                }
            } catch (error) {
                alert("❌ Erro ao conectar com o servidor.");
            }
        });
    }
});