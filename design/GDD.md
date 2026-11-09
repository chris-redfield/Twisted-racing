# GDD — Mad Fruits
Version: 3 · Date: 2026-09-25 · Status: confirmado
Reader profile: hobbyist — usa linguagem técnica e explica cada jargão na primeira ocorrência em até 5 palavras; não altera o conteúdo do jogo.

> **Marcadores.** `[OPEN]` = decisão ainda não respondida pela pessoa. `[PROPOSED]` = proposta da agente aguardando confirmação. `[ASSUMPTION]` = padrão escolhido pela agente após delegação explícita.

## G-1 Identidade
- **Título:** Mad Fruits.
- **Pitch em uma frase:** Dirija um carro armado, sobreviva aos rivais ou chegue vivo ao fim da corrida e inicie outra partida.
- **Fantasia do jogador:** Você é um piloto sobrevivente que reage a perseguições, tiros e colisões para manter seu carro inteiro até o fim.
- **Alvos estéticos (MDA):** Sensation (resposta sensorial imediata) + Challenge (teste de habilidade).
- **Gênero:** corrida arcade / combate veicular.
- **5 palavras-chave:** carros armados, corrida, destruição, arcade, partidas repetíveis.
- **Jogos de referência:** *Rock n’ Roll Racing* — corrida com armamentos; *Twisted Metal* — combate entre veículos.

## G-2 Plataforma e público
- **Plataforma:** navegador web agora; desktop Steam depois, fora do escopo da primeira versão web.
- **Motor-alvo:** HTML5 Canvas 2D + JavaScript ES2024, stack própria sem engine externa ou dependências; o repositório contém `scrapheap-madmax-ascii.html` como build jogável.
- **Comando de build:** não existe; o build é o arquivo HTML único.
- **Comando de verificação:** `node tools/headless.js scrapheap-madmax-ascii.html 10` deve encerrar com código 0.
- **Comando de execução:** `xdg-open scrapheap-madmax-ascii.html` ou `python3 -m http.server 8000`
- **Verificação manual mínima:** em cada uma das 3 pistas, confirmar vitória, derrota, save/reload e mínimo de 30 FPS a 1280×720.
- **Dispositivos de entrada:** teclado e mouse; gamepad não entra na primeira versão web.
- **Faixa de desempenho:** web — mínimo de 30 FPS a 1280×720 em Chrome ou Firefox num notebook básico de 2018; download máximo de 25 MB.
- **Público:** 14–35 anos · habilidade intermediária · familiaridade com arcade clássico, fliperama e jogos de carro com destruição.
- **Duração de sessão:** 3–5 min.
- **Tempo total de jogo:** 1–1,4 h para concluir as 3 pistas e adquirir as 9 melhorias.

## G-3 Loop principal e controles
- **Loop principal:**
  1. Dirigir pelo percurso ou arena.
  2. Encontrar veículos inimigos.
  3. Usar armas para destruí-los ou afastá-los.
  4. Sobreviver ou alcançar a linha de chegada.
  5. Iniciar outra partida.

  Período de um loop: 60–120 s.
- **Câmera:** duas câmeras simultâneas: isométrica fixa em 3/4 superior e primeira pessoa. Cada câmera ocupa 50% da tela; a isométrica mostra 24×14 m e a primeira pessoa usa raycasting (raios 2D para detectar obstáculos) com FOV (campo de visão) de 90°.
- **Entidades controladas pelo jogador:** 1 carro.
- **Movimento:** híbrido de trilho leve e arcade com derrapagem: velocidade máxima de 24 m/s, aceleração de 8 m/s² e giro de 90°/s; a derrapagem dura 1,0 s e o carro retorna ao eixo da pista em 0,6 s.
- **HUD e layout:** a 1280×720, a câmera isométrica ocupa 640×360 à esquerda e a câmera de raycasting ocupa 640×360 à direita. HUD sobreposto: HP e arma no canto inferior esquerdo; munição e sucata no canto inferior direito; objetivo no centro inferior.
- **Mapa de controles:**

| Entrada | Ação |
| --- | --- |
| `↑` | Acelerar |
| `↓` | Frear e dar ré |
| `←` | Virar à esquerda |
| `→` | Virar à direita |
| Mouse | Mirar a arma na câmera em primeira pessoa |
| Clique esquerdo | Disparar a arma selecionada |
| `Z` | Selecionar metralhadora |
| `X` | Selecionar míssil |
| `C` | Selecionar mina |
| `Shift` | Iniciar derrapagem |
| `R` | Reiniciar pista |

## G-4 Sistemas
- **Geração do mundo:** pistas autorais; posições de inimigos e pickups são definidas manualmente por pista. Serve Sensation + Challenge: percurso legível sustenta reação e posicionamento.
- **Combate:** 3 armas já implementadas: metralhadora (10 dano, 150 ms entre tiros, munição infinita), míssil (40 dano, 900 ms entre disparos, inicia/capacidade de 2) e mina (60 dano, 1.200 ms entre lançamentos, inicia/capacidade de 1). HP é definido por inimigo na G-5: a metralhadora elimina perseguidor/bloqueador/atirador em 1,2 / 1,8 / 1,5 s de fogo contínuo; míssil e mina reduzem 40 e 60 HP, respectivamente. A detecção usa colisão circular (sobreposição de círculos). Serve Sensation + Challenge: cada arma exige distância e cadência específicas. Melhor situação: metralhadora a até 10 m sem explosivo; míssil a 6–14 m contra bloqueador; mina com rival a até 4 m atrás.
- **IA inimiga:** 3 FSMs (máquinas de estados): perseguidor, 80 HP, `CHASE` → `RAM` ao chegar a 2 m e `RAM` → `CHASE` ao afastar 3 m, 15 dano por impacto com cadência de 1.000 ms; bloqueador, 120 HP, `OVERTAKE` → `BLOCK` ao chegar a 4 m à frente e `BLOCK` → `OVERTAKE` ao ficar a mais de 8 m do alvo, 25 dano por colisão com cadência de 1.000 ms; atirador, 100 HP, `KEEP_RANGE` de 8–14 m → `FIRE` a 10 m, 1 tiro por 1.000 ms. Os 3 rivais da corrida usam `RACE_LINE` → `OVERTAKE` quando um rival está a até 8 m → `BLOCK` após ficar 4 m à frente → `ATTACK` com alvo a 6–12 m; retornam a `RACE_LINE` ao abrir 10 m. Usam metralhadora (10 dano/300 ms), míssil (40 dano/2.000 ms) e mina (60 dano/3.000 ms quando há rival a até 4 m atrás). No encontro do chefe, a Fase 1 inclui 1 perseguidor; a Fase 2 inclui 1 perseguidor e 1 atirador. A regra de +1 inimigo por 5 destruições não se aplica nesse encontro. Serve Sensation + Challenge: comportamentos legíveis criam reação e posicionamento.
- **Quebra-cabeças:** 3 bloqueios de rota, 1 por pista: destruir 1 alvo de 100 HP ou acionar 1 placa abre a rota segura, que evita 2 inimigos; não há sucata extra nem falha permanente. Serve Challenge: escolher risco e tempo de rota. Acione a placa quando a rota segura custa até 2 s; destrua o alvo quando há ao menos 3 s sem perder uma vida.
- **Outros sistemas:** Serve Challenge: sucata, pickups e save estabelecem escolhas persistentes entre partidas. Sucata: 20 unidades por completar uma pista e +5 por inimigo destruído. As 3 linhas de melhoria têm 3 níveis e custam 30 / 60 / 90 sucatas por nível. Pickups: cada pista de sobrevivência contém 8 e a pista de corrida contém 6; cada pickup alterna entre +1 míssil e +1 mina, e renasce 30 s após coleta. Cada pista também tem 2 pickups de reparo de +25 HP, sem devolver vidas. `localStorage` versionado (armazenamento local do navegador), chave `mad-fruits.save.v1`, salva sucata, vitórias, desbloqueios, 9 níveis e melhor tempo por pista.
- **Ciclos de feedback:** ciclo de sucata positivo: vitória e destruições rendem sucata, que compra poder e eleva a chance da próxima vitória; freio: custo por nível sobe 30 → 60 → 90 e cada linha termina no nível 3. Escalonamento de dificuldade negativo: a cada 5 inimigos destruídos, +1 inimigo ativo, de 2 até 5, estabiliza o poder ganho com melhorias.

## G-5 Inventário de conteúdo
- **Níveis/zonas:** 3 pistas autorais × 3–5 min: 2 pistas de sobrevivência de 3.000 m, com checkpoints em 1.000 m, 2.000 m e 3.000 m; 1 pista de corrida com 3 voltas, 3 rivais (4 carros no total) e 4 checkpoints por volta, a cada 25% do circuito. Cada sobrevivência inicia com 1 perseguidor, 1 bloqueador e 1 atirador; a corrida inicia com os 3 rivais.
- **Biomas/conjuntos de ambiente:** 1 — cidade cyberpunk distópica; 2 veículos de tráfego corporativo cruzam interseções a 12 m/s em janelas de 4 s. Colidir causa 20 dano e reduz a velocidade em 30% por 1 s.
- **Tipos de inimigo:** 3:

| nome | HP | dano/acerto | velocidade m/s | arquétipo de comportamento | pista | encontrado em (bioma) |
| --- | --- | --- | --- | --- | --- | --- |
| Perseguidor | 80 | 15 | 22 | `CHASE` → `RAM` | 2 pistas de sobrevivência | cidade cyberpunk distópica |
| Bloqueador | 120 | 25 | 18 | `OVERTAKE` → `BLOCK` | 2 pistas de sobrevivência | cidade cyberpunk distópica |
| Atirador | 100 | 10 | 16 | `KEEP_RANGE` → `FIRE` | 3 pistas | cidade cyberpunk distópica |

- **Chefes:** 1 — Caminhão blindado, 500 HP, 2 fases, no fim da segunda pista de sobrevivência: surge quando `playerDistance >= 90%` da Pista 2. O encontro ocorre num circuito circular de 80 m, com 2 faixas de 4 m; a saída abre apenas quando o chefe chega a 0 HP. Fase 1: bloqueia a pista e lança minas a cada 2 s; fase 2 a 250 HP: persegue a 20 m/s e dispara míssil a cada 1,2 s.
- **Itens de progressão:** armas: 3 — metralhadora disponível no início, míssil após 1 vitória e mina após 3 vitórias; habilidades: 0; melhorias passivas: 3 linhas × 3 níveis — blindagem (+20 HP por nível), motor (+2 m/s por nível) e dano (+10% por nível). Cada nível custa 30 / 60 / 90 sucatas; melhor situação: blindagem quando a corrida começa com HP ≤50, motor na pista de corrida e dano contra o chefe; colecionáveis: 0.
- **NPCs:** 0.

## G-6 Vitória, derrota e progressão
- **Condição de vitória:** na primeira pista de sobrevivência, `playerReachedFinish == true && playerHP > 0`; na segunda, `bossHP <= 0` concede +50 sucatas, abre a saída e o jogador vence ao cruzá-la vivo; na pista de corrida, `playerFinishPosition == 1 && playerHP > 0`.
- **Condição de derrota:** `playerHP <= 0` consome 1 de 3 vidas e reaparece no último checkpoint com 50 HP e munição na capacidade máxima (2 mísseis, 1 mina); durante o encontro do chefe, reaparece no início da arena e o chefe mantém o HP atual. Ao zerar as 3 vidas, abre a tela de resultado e permite reiniciar a pista. Toda a sucata adquirida antes da destruição é mantida.
- **Fluxo de telas:** Título → pista → resultado → repetir. O título oferece Jogar e Resetar save; o resultado oferece Repetir, Próxima pista e Título, além de vitória/derrota, sucata e melhor tempo.
- **Curva de dificuldade:** a cada 5 inimigos destruídos, inimigos ativos aumentam em 1, do mínimo de 2 ao máximo de 5. A progressão de padrões ocupa 3 ciclos de 20 min: 0–20 min, perseguidor; 20–40 min, bloqueador; 40–60 min, atirador e tráfego corporativo; após 60 min, só combina padrões já apresentados. Aos 60 min, a cadência alcança pelo menos 70% do teto de 1,4 h. Na corrida, um rival com deslocamento menor que 1 m por 2 s ou a mais de 3 m da pista reaparece no último checkpoint com 50 HP e 12 m/s. Ao atingir 0 HP, reaparece após 3 s no último checkpoint com 50 HP e o mesmo progresso; não perde colocação automaticamente.
- **Fator de repetição:** desbloqueio de míssil após 1 vitória e de mina após 3 vitórias; 9 níveis de melhorias e melhores tempos por pista. `localStorage` versionado, chave `mad-fruits.save.v1`, preserva sucata, vitórias, desbloqueios, níveis e tempos entre sessões.

## G-7 Guardas de escopo
- **Explicitamente FORA do escopo:** multiplayer online; gamepad; versão Steam; localização; qualquer conteúdo além das 3 pistas, 3 inimigos e 1 chefe de G-5.
- **Ordem de corte de conteúdo:** 1. chefe de G-5; 2. bloqueios de rota de G-4; 3. terceira pista de G-5; 4. terceiro inimigo de G-5; 5. segunda câmera de G-3.

## G-8 Direção de arte e áudio
- **Estilo visual:** cidade cyberpunk distópica em sprites 2D desenhados à mão, não pixel art, com recorte de quadrinhos, hachura de 2 px e contorno de 3 px; carro e inimigos em sprites de até 256×256 px, 8 direções por carro e 6 quadros por explosão.
- **Paleta:** 12 cores — preto `#0A0B12`, grafite `#202433`, aço `#526070`, branco `#EAF6FF`, ciano `#20E3FF`, azul `#2D63FF`, violeta `#9B4DFF`, magenta `#FF3CAD`, rosa `#FF80C8`, laranja `#FF8A3D`, amarelo `#FFE66D` e vermelho `#FF3B4D`.
- **Linguagem de orientação:**

| Classe de sinal | Código visual fixo |
| --- | --- |
| Inimigo | ícone de mira com contorno de 4 px |
| Dano | ícone de impacto com contorno de 4 px |
| Objetivo/chegada | ícone de bandeira com contorno de 4 px |
| Pickup | ícone de caixa com contorno de 4 px |

- **Áudio:** 1 faixa musical licenciada e 12 efeitos licenciados: tiro, míssil, mina, explosão, colisão, dano, motor, derrapagem, pickup, vitória, derrota e compra.

## Registro de suposições
- G-1 gênero combate veicular / corrida arcade → 2026-09-25.
- G-1 referências *Rock n’ Roll Racing* e *Twisted Metal* → 2026-09-25.
- G-2 navegador web e teclado + mouse, inferidos do HTML Canvas existente → 2026-09-25.
- G-3 uma entidade controlada, o carro → 2026-09-25.
