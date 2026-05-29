document.addEventListener("DOMContentLoaded", async () => {
    const feedContainer = document.getElementById('forum-feed-container');
    if (!feedContainer) return;

    try {
        // Busca do MongoDB
        const response = await fetch('http://localhost:3000/api/posts');
        const posts = await response.json();

        feedContainer.innerHTML = ''; 

        posts.forEach((item) => {
            let statusBadge = item.statusResolvido ? `<span class="best-answer-badge">Resolvido</span>` : "";
            
            feedContainer.innerHTML += `
            <div class="question-card ${item.statusResolvido ? 'solved' : ''}">
                <div class="stats">
                    <div class="stat-item">
                        <span class="votes" id="vote-${item._id}">${item.votos}</span> 
                        <i class="fas fa-caret-up upvote-btn" onclick="votar('${item._id}')"></i>
                    </div>
                </div>
                <div class="question-content">
                    <h3>${item.titulo}</h3>
                    <p>${item.desc}</p>
                    <div class="author-info">Por: ${item.author}</div>
                    ${statusBadge}
                </div>
            </div>`;
        });
    } catch (error) {
        feedContainer.innerHTML = "<p>Erro ao carregar dados do MongoDB.</p>";
    }
});

async function votar(id) {
    const res = await fetch(`http://localhost:3000/api/posts/${id}/vote`, { method: 'PATCH' });
    const data = await res.json();
    document.getElementById(`vote-${id}`).innerText = data.votos;
}