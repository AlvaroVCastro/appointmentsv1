# Plano: Filtros na Admin Dashboard

## Objetivo
Adicionar filtros **Clínica** e **Médico** à admin dashboard + stats agregadas por clínica.

---

## Progresso

- [x] **Fase 1: Base de Dados**
  - [x] Adicionar colunas `clinics[]` e `service_codes[]` a `admin_dashboard_stats`
  - [x] Criar tabela `clinic_stats` com mesmas métricas da dashboard
  - [x] Criar índices GIN para arrays
  - [x] Adicionar RLS policies para `clinic_stats`

- [x] **Fase 2: Edge Function**
  - [x] Modificar `compute-dashboard-stats` para extrair clínicas dos appointments
  - [x] Popular arrays `clinics[]` e `service_codes[]` por médico
  - [x] Calcular e guardar stats por clínica na `clinic_stats`

- [x] **Fase 3: Backend APIs**
  - [x] Criar `/api/dashboard/filters` - retornar opções de filtros
  - [x] Criar `/api/dashboard/clinic-stats` - retornar stats por clínica
  - [x] Modificar `/api/dashboard/stats` - aceitar filtro por clínica

- [x] **Fase 4: Frontend**
  - [x] Criar componente `DashboardFilters`
  - [ ] Adicionar vista de stats por clínica (opcional - pode usar a API clinic-stats)
  - [ ] Adicionar TOP 10 melhores/piores médicos (opcional)
  - [ ] Pesquisa por número de médico (opcional - já funciona via dropdown)

---

## Estrutura das Tabelas

### admin_dashboard_stats (existente + novas colunas)

```
doctor_code | doctor_name | occupation_% | clinics[]        | service_codes[]
------------+-------------+--------------+------------------+-----------------
123         | Dr. Silva   | 85%          | {Lisboa,Porto}   | {436,440}
456         | Dr. Santos  | 72%          | {Coimbra}        | {500}
```

### clinic_stats (NOVA)

```
clinic  | total_doctors | avg_occup% | reschedules_30d | monthly_occup%
--------+---------------+------------+-----------------+----------------
Lisboa  | 12            | 78.5%      | 45              | 72.3%
Porto   | 8             | 82.3%      | 28              | 79.1%
Coimbra | 5             | 65.0%      | 12              | 68.5%
```

---

## Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────────────┐
│                     EDGE FUNCTION (CRON 7:00 AM)                    │
│                                                                     │
│  Para cada médico:                                                  │
│    1. Busca appointments do dia (Glintt)                            │
│    2. Extrai clínicas do performingService.description              │
│    3. Guarda em admin_dashboard_stats com clinics[], service_codes[]│
│                                                                     │
│  No final:                                                          │
│    4. Agrupa médicos por clínica                                    │
│    5. Calcula stats agregadas (média ocupação, total reschedules)   │
│    6. Guarda em clinic_stats                                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Features da Admin Dashboard

### 1. Pesquisa por Médico
- Input para pesquisar por número de médico
- Mostra stats desse médico específico

### 2. TOP 10 Médicos
- Botão para ver TOP 10 com melhor occupation_rate
- Botão para ver TOP 10 com pior occupation_rate

### 3. Vista por Clínica
- Dropdown para selecionar clínica
- Mostra os 4 cards (Total Médicos, Ocupação Média, Reagendamentos, Ocupação Mensal)
- Lista de médicos dessa clínica com stats individuais

---

## Ficheiros Modificados/Criados

| Ficheiro | Estado |
|----------|--------|
| `backend/sql/007_admin_dashboard_filters.sql` | ✅ Criado - tabelas e índices |
| `supabase/functions/compute-dashboard-stats/index.ts` | ✅ Modificado - extrai clínicas, popula clinic_stats |
| `frontend/src/app/api/dashboard/filters/route.ts` | ✅ Criado - opções de filtros |
| `frontend/src/app/api/dashboard/clinic-stats/route.ts` | ✅ Criado - stats por clínica |
| `frontend/src/app/api/dashboard/stats/route.ts` | ✅ Modificado - aceita filtro por clínica |
| `frontend/src/components/admin/dashboard-filters.tsx` | ✅ Criado - UI filtros |
| `frontend/src/app/admin-dashboard/page.tsx` | ✅ Modificado - integra filtros |

---

## SQL Executado

### 1. Colunas em admin_dashboard_stats
```sql
ALTER TABLE appointments_app.admin_dashboard_stats
ADD COLUMN IF NOT EXISTS clinics text[];

ALTER TABLE appointments_app.admin_dashboard_stats
ADD COLUMN IF NOT EXISTS service_codes text[];

CREATE INDEX IF NOT EXISTS idx_admin_dashboard_stats_clinics
ON appointments_app.admin_dashboard_stats USING GIN (clinics);

CREATE INDEX IF NOT EXISTS idx_admin_dashboard_stats_service_codes
ON appointments_app.admin_dashboard_stats USING GIN (service_codes);
```

### 2. Tabela clinic_stats
```sql
CREATE TABLE appointments_app.clinic_stats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic text NOT NULL,
    total_doctors integer DEFAULT 0,
    avg_occupation_percentage numeric(5,2),
    total_reschedules_30d integer DEFAULT 0,
    monthly_occupation_percentage numeric(5,2),
    total_slots integer DEFAULT 0,
    total_occupied_slots integer DEFAULT 0,
    monthly_total_slots integer DEFAULT 0,
    monthly_occupied_slots integer DEFAULT 0,
    days_counted integer DEFAULT 0,
    computed_at timestamp NOT NULL DEFAULT now()
);
```

---

## Estado Atual

✅ **Implementação base concluída!**

A admin dashboard agora tem:
- Dropdown para filtrar por **Clínica**
- Dropdown para filtrar por **Médico**
- Filtros são cumulativos (AND)
- Botão "Limpar" para remover filtros

**Próximos passos (opcionais):**
1. Fazer deploy da Edge Function atualizada
2. Adicionar médicos à tabela `user_profiles` para testar
3. Correr a Edge Function manualmente ou esperar pelas 7:00 AM
