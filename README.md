# Treino & Nutrição

App web pessoal (PWA, mobile-first, português europeu) para treino, sono, peso e alimentação, com treinador IA.
Stack: **Next.js 16 (App Router) + TypeScript + Tailwind · Supabase (Postgres, Auth por magic link, Storage, RLS) · Vercel · Anthropic (treinador) · Gemini (fotos e texto das refeições) · Recharts · Vitest**.

## O que faz

| Ecrã | Conteúdo |
|---|---|
| **Hoje** (`/`) | Metas do dia (kcal e macros com "Falta"/excedido, saldo), refeições com editar/apagar, adicionar comida (favoritos de 1 toque, foto, texto livre, "Igual a…" com multiplicador, receitas), treino planeado vs feito, sono da última noite, peso, passos, notas. Setas para outros dias (`/dia/AAAA-MM-DD`). |
| **Diário** | Tabela por dia (mais recente primeiro) com todos os totais; toque numa data para editar. Exporta CSV. |
| **Evolução** | Filtros (14/30/60/tudo, semana Seg–Dom, intervalo), KPIs, gráficos (peso + média semanal + objetivo, kcal vs alvo, saldo, macros vs alvo, passos, treinos por tipo, sono + média 7 dias, ritmo por tipo de treino, eficiência aeróbica e FC a ~5:30/km), resumo semanal, tabela e exportação CSV/Excel. |
| **Plano** | Plano até 20/12/2026 (específica → afinamento → meia → recuperação → específica 10 km → afinamento → GP de Natal), vista semanal e calendário, planeado vs realizado automático, cumprimento por semana, editar/mover com motivo obrigatório e histórico, plano de força Qua/Sex editável, contagem decrescente das provas. |
| **Treinos** | Lista, detalhe com parciais por km, voltas, FC, subida/descida, rumo por km (vento), custo cardíaco, comparação com o plano e com treinos semelhantes, condições e sensação, análise da IA. Upload de `.FIT` e treino manual. |
| **Treinador** | Chat com ferramentas que leem a base de dados (nunca inventa números), revisão semanal com proposta que só se aplica ao plano quando aceitas, projeção de prova com intervalo e pressupostos. |
| **Alimentos** | Alimentos padrão/personalizados (★ favoritos), receitas com n.º de porções e refeições favoritas. |
| **Definições** | Perfil, objetivos, zonas, alvos, fases calóricas, fator de exercício, provas, estado da ligação ao Intervals.icu, importação do histórico, exportar tudo (JSON/CSV/Excel). |

Todas as contas (exercício ajustado, alvo por fase, macros-alvo, "Falta", saldo, custo cardíaco, sono, médias semanais, projeção de Riegel) vivem em funções puras em `lib/calc/` com testes (`npm test`). A interface, as exportações e a IA usam sempre essas funções.

## Instalação (uma vez, ~20 min)

### 1. Supabase
1. Cria um projeto em <https://supabase.com> (região EU).
2. **SQL Editor** → cola e corre `supabase/migrations/20261112000001_schema.sql` (tabelas, RLS, vista `v_day_summary`, bucket privado `uploads`).
3. **Authentication → URL Configuration**: *Site URL* = URL da Vercel (ex.: `https://treino-xxx.vercel.app`); em *Redirect URLs* adiciona `https://treino-xxx.vercel.app/auth/confirm` e `http://localhost:3000/auth/confirm`.
4. **Project Settings → API**: copia o *Project URL*, a chave *anon/publishable* e a *service_role* (esta é secreta).
5. Depois do primeiro login, em **Authentication → Sign In / Providers** desliga *Allow new users to sign up* (a app já recusa outros emails, isto fecha a porta também do lado do Supabase).

### 2. Chaves de terceiros
- **Intervals.icu** → *Settings → Developer Settings*: Athlete ID (ex.: `i12345`) e API key.
- **Gemini** → <https://aistudio.google.com/apikey> (plano gratuito). Nota: no plano gratuito a Google pode usar os pedidos para melhorar os modelos; se não quiseres isso nas fotos das refeições, ativa a faturação na Google ou usa `FOOD_AI_PROVIDER=anthropic`.
- **Anthropic** → <https://console.anthropic.com> → API Keys.
- **CRON_SECRET** → gera um valor aleatório longo (ex.: `openssl rand -hex 32`).

### 3. Vercel
1. *Add New → Project* → importa este repositório do GitHub.
2. Em *Environment Variables* preenche tudo o que está em `.env.example` (nunca no código nem no chat).
3. Deploy. Abre a app no telemóvel, entra com o teu email (magic link) e adiciona ao ecrã principal (Partilhar → *Adicionar ao ecrã principal*).

### 4. Sincronização de hora a hora
O plano Hobby da Vercel só permite cron **diário** (o `vercel.json` já tem um, às 05:30 UTC, como reserva). Para hora a hora usa o `pg_cron` do Supabase (gratuito):
1. Supabase → *Database → Extensions*: ativa `pg_cron` e `pg_net`.
2. *SQL Editor*: `select vault.create_secret('<o mesmo CRON_SECRET>', 'cron_secret');`
3. Corre `supabase/cron.sql` depois de substituíres `<APP_URL>`.

Isto também evita que o projeto gratuito do Supabase pause por inatividade. A app sincroniza ainda ao abrir (no máximo a cada 20 min) e com o botão "Sincronizar agora".

### 5. Histórico
- **Sem terminal:** *Definições → Importar histórico* → escolhe `seed_entries.json`. No fim a app compara os totais, exercício, saldos, peso e sono com o ficheiro e diz se há diferenças.
- **Com terminal:** coloca o ficheiro em `data/seed_entries.json` (ignorado pelo git), cria `.env.local` e corre `npm run import-seed`.
- Depois, *Definições → Importar histórico do Intervals (120 dias)* traz as atividades e o wellness reais; as atividades-resumo do histórico desses dias são substituídas sem mexer nos totais do dia (o gasto de exercício do ficheiro prevalece, como valor manual).

## Desenvolvimento

```bash
npm install
cp .env.example .env.local   # preencher
npm run dev                  # http://localhost:3000
npm test                     # testes de cálculo, importação, Intervals, FIT, plano
npm run build
```

## Regras de dados
- `user_id` + RLS (`auth.uid() = user_id`) em todas as tabelas; bucket `uploads` privado, por pasta do utilizador.
- Sincronização idempotente (upsert por `external_id`); valores manuais e do histórico **nunca** são substituídos (`weight_source`, `steps_source`, `sleep.source`).
- Sono: a noite que acaba na manhã do dia X fica no dia X−1; profundo + leve + REM tem de dar o total.
- Chaves só no servidor (route handlers / server actions). O browser só recebe a URL e a chave pública do Supabase.

## Decisões e limitações
- **Fases do sono:** a API do Intervals.icu documenta `sleepSecs`, `sleepScore` e `sleepQuality`; fases (profundo/leve/REM) não aparecem na documentação pública. A app importa o total e a pontuação e procura automaticamente campos de fases se existirem na tua conta (*Definições → Ver campos de wellness disponíveis*). Se não existirem, as fases introduzem-se no ecrã Hoje no mesmo formato do histórico (`7:35 (profundo 1:37, leve 4:49, REM 1:09, acordado 27min)`).
- **Peso:** vem do Intervals.icu se tiveres balança ligada ao Garmin Connect (ou o registares lá); caso contrário, campo rápido no ecrã Hoje.
- **Vista `v_day_summary`:** soma os valores guardados por dia; os números derivados (ajustado, alvo, "Falta", saldo) são calculados em `lib/calc/day.ts`, para que existam num só sítio e com testes.
- **Excel:** exportado como CSV com `;` e vírgula decimal (abre diretamente no Excel em português).
- **Strava** (opcional) e **notificações** não estão implementados.
