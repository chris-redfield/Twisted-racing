# Validação de mercado — 🟡 Amarelo

> Gerado a partir de `/design/market.storia.json`. O veredito, os números e a tabela abaixo são calculados em código a partir desse arquivo — edite apenas a seção de análise e rode a validação de novo para atualizar o resto.

Arriscado, mas possível. A meta está na metade superior do nicho, não no centro dele — os fatores abaixo são os que puxariam para verde.

## Por que este veredito

- 3 de 8 comparáveis (38%) alcançam a meta de US$ 10.000.
- A receita bruta estimada mediana é US$ 5.656, abaixo da meta de US$ 10.000.
- A metade central do nicho fatura US$ 1.207–US$ 21.257; o quartil superior está igual ou acima da meta.
- A nota mediana de reviews do nicho é 85% positiva (80% é o piso do verde).
- Nenhum comparável lançou nos últimos 24 meses — o nicho pode ter esfriado.

## Os números

| Métrica | Valor |
| --- | --- |
| Receita bruta estimada mediana | US$ 5.656 |
| Metade central (P25–P75) | US$ 1.207 – US$ 21.257 |
| Comparáveis que alcançam US$ 10.000 | 38% |
| Nota mediana de reviews | 85% |
| Lançados nos últimos 24 meses | 0 / 8 |
| Comparáveis contados | 8 |

## Comparáveis

| Jogo | Lançamento | Preço | Reviews | Positivas | Unid. est. | Bruto est. |
| --- | --- | --- | --- | --- | --- | --- |
| Trash Top Down Racing — Racing, Combat Racing, Casual, Driving | 2024-01-10 | US$ 5 | 11 | 55% | 330 | US$ 1.235 |
| RC Death Race: Multiplayer — Combat Racing, Racing, Sports, PvP | 2022-03-20 | US$ 3 | 16 | 63% | 480 | US$ 1.076 |
| Total Arcade Racing — Racing, Local Multiplayer, Party, Competitive | 2021-05-06 | US$ 10 | 31 | 100% | 930 | US$ 6.968 |
| Rude Racers: 2D Combat Racing — Combat Racing, Action, Beat 'em up, ATV | 2020-09-24 | US$ 2 | 97 | 86% | 2.910 | US$ 4.343 |
| Super Arcade Racing — Racing, Multiplayer, Arcade, Retro | 2019-10-15 | US$ 13 | 95 | 93% | 2.850 | US$ 27.766 |
| GRIP: Combat Racing — Racing, Action, Indie, Automobile Sim | 2018-11-06 | US$ 30 | 5.165 | 85% | 154.950 | US$ 3.485.213 |
| Death Race VR — Action, Gore, Violent, VR | 2018-10-18 | US$ 5 | 10 | 80% | 300 | US$ 1.123 |
| Gas Guzzlers: Combat Carnage — Combat Racing, Racing, Action, Vehicular Combat | 2017-03-09 | US$ 5 | 170 | 86% | 5.100 | US$ 19.087 |

## Análise

O nicho observado mistura corrida de combate de baixo preço com corridas arcade adjacentes. A amostra inclui um título de maior escala, **GRIP: Combat Racing**, e jogos pequenos com combate veicular explícito, como **Rude Racers: 2D Combat Racing**, **Gas Guzzlers: Combat Carnage**, **Trash Top Down Racing** e **RC Death Race: Multiplayer**. As duas corridas arcade sem combate entram apenas para dar contexto a uma possível navegação de compradores por corrida arcade compacta.

- **Forma comercial heterogênea:** GRIP está a US$ 30, enquanto o preço planejado é US$ 4,99; seu volume pode representar escala e preço que Mad Fruits não compartilha.
- **Aderência de plataforma:** Death Race VR usa VR, mas Mad Fruits é Canvas web com horizonte Steam desktop; sua inclusão mede fantasia de corrida/ação, não substituição direta de plataforma.
- **Aderência de loop:** Super Arcade Racing e Total Arcade Racing compartilham corrida arcade, mas não combate veicular; eles são comparáveis adjacentes, não equivalentes.
- **Recência e histórico:** Gas Guzzlers e Death Race VR são de 2017–2018; seus resultados refletem ciclos de descoberta anteriores aos de um lançamento novo.
- **Preço:** Rude Racers e RC Death Race estão abaixo de US$ 4,99, e GRIP está muito acima; a faixa de preço da amostra é deliberadamente ampla.

- Reposicionar a página Steam com as tags e linguagem “Combat Racing”, “Vehicular Combat”, “Arcade” e “Racing”, registrando-as em G-1 e na página da loja, para separar Mad Fruits de corrida arcade sem armas.
- Fazer uma página Steam de teste com preço de US$ 4,99 e avaliar se a descrição torna visíveis as 3 armas, as 2 câmeras e a condição de sobreviver ou vencer a corrida.
- Produzir uma demo web de 3–5 min da primeira pista e medir conclusão, destruições e repetição antes de assumir que o preço baixo compensa o escopo compacto.
- Revalidar com títulos futuros mais próximos de corrida de combate 2D, sem VR e na faixa de US$ 2–15, quando houver ao menos 8 substitutos diretos.

A estimativa de receita é baseada em reviews e tem faixa de erro de ±2×. GRIP, Death Race VR, Super Arcade Racing e Total Arcade Racing são os comparáveis mais discutíveis; removê-los reduz a amostra abaixo do mínimo de 8, portanto esta leitura mede um conjunto adjacente e não somente substitutos diretos.

## Entradas da validação

| Métrica | Valor |
| --- | --- |
| Meta de receita (bruta) | US$ 10.000 |
| Preço planejado | US$ 5 |
| Multiplicador reviews→unidades | × 30 |
| Palavras-chave | vehicular combat, combat racing, arcade racing, car combat, twisted metal, rock n roll racing, top down racing, vehicular combat arcade |
| Coletado em | 2026-10-02T20:14:05.630Z |
| Hash do GDD | `910f5b2070c9` |

## Método e limites

- As unidades vêm do método Boxleiter: `unidades = reviews × 30`. O multiplicador varia por gênero, faixa de preço e ano de lançamento — trate-o como argumento, não como medição.
- A receita bruta é `unidades × preço × 0.75` (desconto médio ao longo da vida); cerca de 55% dela chega ao desenvolvedor depois do corte da loja, impostos e reembolsos.
- Uma estimativa baseada em reviews carrega erro de cerca de ±2×. Leia a faixa P25–P75, nunca um número isolado.
- Dados de wishlist não são públicos: nenhum número aqui é medido a partir de wishlists.
- Fontes: vitrine da Steam (preço, datas, tags), reviews da Steam (contagens e proporção positiva), SteamSpy quando disponível (faixas de owners, tags com peso).

### Referências de contexto

- A mediana de receita bruta vitalícia de um indie na Steam fica em torno de US$ 5.000–15.000.
- Títulos com 100+ reviews e avaliação "Muito positivas" costumam ficar na faixa de US$ 75.000–300.000+.
- A conversão mediana de wishlists no primeiro mês após o lançamento é de cerca de 27 %.

<!-- Benchmarks: public Steam revenue studies (Boxleiter/Vin St. John reviews-to-sales work), VG Insights and Gamalytic indie revenue distributions, and published wishlist-conversion reports. Order-of-magnitude references, not measurements of this project. -->
