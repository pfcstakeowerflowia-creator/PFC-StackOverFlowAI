document.addEventListener("DOMContentLoaded", () => {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (!isLoggedIn) {
        window.location.href = 'login.html'; return; 
    }
    renderizarPerfilLateral(isLoggedIn);

    const askForm = document.querySelector('.ask-form');
    if (askForm) {
        askForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const tituloVariavelPegadoInputID = document.getElementById('ask-title').value;
            const detalesDescriptionBigTextsCapturingTextarIdBoxedInputValuesJSHTML = document.getElementById('ask-desc').value;

            // Fetch Antigas pra Add Na mesma Caixa De SAPATO de Json Memory Loc!! ou Fazer Ela se For NULA Primeiro Uso do Memória Browse
            let DataBaserepositoryForaAbertoDeMemoraRAMPutaLocalVariaveisJSOnFormatationJsonStorage = JSON.parse(localStorage.getItem('RAG_Perguntas_Dev')) || [];

            DataBaserepositoryForaAbertoDeMemoraRAMPutaLocalVariaveisJSOnFormatationJsonStorage.unshift({
                id: Date.now(), 
                titulo: tituloVariavelPegadoInputID,
                desc: detalesDescriptionBigTextsCapturingTextarIdBoxedInputValuesJSHTML.substring(0, 150) + "... [Continue Reading In Details Panel Features in Model Real API AI RAG Web]", 
                tags: ["RAG New Memory", "Appended Context Node System Human Dev Info Train "], 
                votos: 0,
                author: "Dev Admin - App Loc Base (Human Admin Base Loc Root DB Master )",
                statusResolvido: false
            });

            // SALVA Array!
            localStorage.setItem('RAG_Perguntas_Dev', JSON.stringify(DataBaserepositoryForaAbertoDeMemoraRAMPutaLocalVariaveisJSOnFormatationJsonStorage));

            alert("Operação System Storage (Set e Gets array JSon Manipulado): Salvamento Confirmado!");
            window.location.href = 'forum.html';
        });
    }
});

function renderizarPerfilLateral(isLoggedIn) {
    const wrapper = document.getElementById('sidebar-auth-wrapper');
    if(wrapper && isLoggedIn) {
         wrapper.innerHTML = `
        <div class="user-profile">
            <div class="avatar"><i class="fas fa-user"></i></div>
            <div class="user-info">
                <span class="user-name">Aluno PFC Root Admin Autorizações Master Priv</span>
            </div>
            <i class="fas fa-sign-out-alt config-btn text-danger" onclick="window.logout()"></i>
        </div>`;
    }
}
window.logout = function() {
    localStorage.removeItem('isLoggedIn');
    window.location.href = 'login.html'; 
}