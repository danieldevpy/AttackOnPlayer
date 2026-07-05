# Creative Director Notes — Daniel

Voz do Daniel. A IA registra aqui, mas o conteúdo é decisão dele.

## 2026-07-04 — Concepção
- Jogo simples, 3D, bonecos pequenos genéricos, câmera de cima, campo limitado estilo Bomberman.
- Objetivo: acertar/derrotar com diferentes "armas". Nível sobe e desce; morrer derruba nível, podendo zerar.
- Sessões de sala por nível; sem sala do seu nível, joga com níveis abaixo. Partida alvo: 2–3 min.
- Multiplataforma via web, leve sempre, com controle de ping visível.
- Desenvolvimento em modo debug: mecânica primeiro, arte depois. Bots inteligentes para testar.
- Sistema de aura: quem tem aura precisa de mais mecânica para merecer drops melhores. "Famar" aura para players com mecânica pronta.
- Atributos vantajosos só aparecem longe de jogadores; servidor monitora densidade do mapa.
- Matchmaking como IA de gerenciamento (monitorar quantidade, níveis, decidir abrir/fechar/juntar salas, sortear drops).
- Produção simples e testável via VPS bem localizadas, sem deploy complexo.
- Quer agente que analise tendências atuais e turbine mecânica/gamificação.
- Métricas: entender a sessão de cada jogador + visão coletiva.
- Se der certo, vira portfólio.
- Papel: Creative Director. A IA propõe/argumenta/registra; Daniel decide.

## 2026-07-04 — Decisões que desbloqueiam T-004/T-006

**Box "reset de MU":** quer permanência real durante a "sessão de vida" do jogador — ao trocar de sala/round, atributos (força etc.) podem se manter ou avançar, dentro de limites medidos, com balanceamento pensado para servidor grande (várias rooms, população escalando). Quer poder ver cada ponto de atributo acumulado, mas isso só aparece no **modo desenvolvimento** por enquanto — é peça de infraestrutura que contribui com a sessão e fica pronta para ser "acionada" (ligada de verdade na gameplay) depois.

**Coins:** devem comprar algo já nesta task (não só acumular).

**Perda de nível na morte:** nível baixo perde pouco atributo ao morrer; nível muito avançado tem perda muito maior (escala com o nível, não é fixo). Quer também o conceito de "crítico" e camadas de defesa — vida/atributo primeiro (simples), depois armadura, depois aura determinando chance de sobreviver — mantendo o jogo dinâmico. Reset total deve existir, mas como **opção ativável** (por room e/ou modo global), não comportamento único.

**Registrado por:** IA, ver interpretação técnica e limites de escopo em `docs/LEAD_DESIGNER_NOTES.md` (mesma data) e ADR-012.

## 2026-07-05 — Primeiro teste manual da V1 (perfis de controle + bots + bandeira)

**Perfil keyboard:** movimentação absoluta (WASD estilo strafe) com setas girando ficou complicada — quer **tank controls**: W/S andam/recuam baseado na rotação do jogador.

**Bots devem simular players:** *"ataca, vai pra cima, às vezes corre, às vezes volta a atacar; quando se sentir encurralado, para de correr e volta a atacar"*. Rejeitado: fuga infinita com vida baixa, esfregar na borda do mapa sem atirar, todos com o mesmo comportamento. Quer **comportamentos específicos por bot** + uma **dosagem** dessas características para cada bot iniciado.

**Bandeira:** não quer todos os bots focando o portador — quer **conflitos entre si**, com o portador como um alvo possível; os bots devem "**compartilhar**" os alvos para dividir bem a jogatina. Disputar tem que incluir atirar (perseguição sem tiro rejeitada). Regra de retorno: caída e não disputada em **5 segundos**, volta ao centro.

**Sessões de teste:** precisa conseguir iniciar ~10 bots juntos na mesma partida (`npm run bots`), cada um com perfil sorteado diferente.

**Registrado por:** IA — implementação e interpretação técnica em `docs/prompts/PROMPT-0032.md`; veredito final: aprovado ("está melhor agora").
