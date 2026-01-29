# Diagrama: Fluxo de Dados - Dashboard Stats

## Estado Atual da Implementação

**O que está implementado:**
- Edge Function `compute-dashboard-stats` com processamento paralelo
- `clinics[]` e `service_codes[]` agregados dos últimos 30 dias
- `occupation_percentage` calculado apenas para HOJE
- Stats agregadas por clínica na tabela `clinic_stats`

**O que NÃO está implementado:**
- Edge Function `populate-doctor-history` (para novos médicos) - ainda não existe

---

## Fluxo: Edge Function compute-dashboard-stats

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     TRIGGER: Cron 7:00 AM OU chamada manual                 │
│                     POST /functions/v1/compute-dashboard-stats              │
│                     Header: api-key: [EDGE_FUNCTION_APPOINTMENTS_KEY]       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. VALIDAÇÃO                                                               │
│                                                                             │
│     - Verifica API key no header                                            │
│     - Se inválida → 401 Unauthorized                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  2. BUSCAR MÉDICOS                                                          │
│                                                                             │
│     SELECT id, doctor_code, full_name                                       │
│     FROM appointments_app.user_profiles                                     │
│     WHERE doctor_code IS NOT NULL                                           │
│                                                                             │
│     Se 0 médicos → return { success: true, message: "No doctors", count: 0 }│
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  3. OBTER TOKEN GLINTT                                                      │
│                                                                             │
│     POST /Glintt.GPlatform.APIGateway.CoreWebAPI/token                      │
│     Body: client_id, client_secret, grant_type=password, TenantID=DEFAULT   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  4. PROCESSAR MÉDICOS EM PARALELO (batches de 10)                           │
│                                                                             │
│     Para cada batch de 10 médicos:                                          │
│       Promise.all([processDoctor(m1), processDoctor(m2), ..., processDoctor(m10)])│
│       200ms delay entre batches                                             │
│                                                                             │
│     ┌─────────────────────────────────────────────────────────────────┐     │
│     │  processDoctor(doctor):                                         │     │
│     │                                                                 │     │
│     │  a) getServiceCodesForDoctor(doctorCode, token)                 │     │
│     │     → POST /humanresources/search-detail                        │     │
│     │     → Retorna: ["436", "440", "500", ...]                       │     │
│     │                                                                 │     │
│     │  b) Para cada dia dos ÚLTIMOS 30 DIAS (batches de 5 dias):      │     │
│     │     → GET /Appointment?doctorCode=X&beginDate=Y&endDate=Y       │     │
│     │     → Extrair clinic de performingService.description           │     │
│     │       "Coimbra - Dep. Prótese Fixa" → "Coimbra"                 │     │
│     │     → Coletar service_codes dos appointments                    │     │
│     │     → 50ms delay entre batches de dias                          │     │
│     │                                                                 │     │
│     │  c) Para HOJE apenas, buscar slots:                             │     │
│     │     → POST /ExternalSearchSlots (para cada serviceCode)         │     │
│     │     → Contar: total_slots (excluindo B=blocked)                 │     │
│     │     → Contar: occupied_slots (S=scheduled ou Occupation=true)   │     │
│     │     → Calcular: occupation_percentage = occupied/total * 100    │     │
│     │                                                                 │     │
│     │  d) Contar reschedules (Supabase):                              │     │
│     │     → SELECT COUNT(*) FROM reschedules                          │     │
│     │       WHERE doctor_code = X                                     │     │
│     │       AND new_datetime >= (hoje - 30 dias)                      │     │
│     │       AND status = 'completed'                                  │     │
│     │                                                                 │     │
│     │  Retorna:                                                       │     │
│     │  {                                                              │     │
│     │    doctor_code, doctor_name,                                    │     │
│     │    occupation_percentage,  ← SÓ DE HOJE                         │     │
│     │    total_slots,            ← SÓ DE HOJE                         │     │
│     │    occupied_slots,         ← SÓ DE HOJE                         │     │
│     │    total_reschedules_30d,  ← ÚLTIMOS 30 DIAS                    │     │
│     │    clinics[],              ← TODAS dos últimos 30 dias          │     │
│     │    service_codes[]         ← TODOS dos últimos 30 dias          │     │
│     │  }                                                              │     │
│     └─────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  5. GUARDAR EM admin_dashboard_stats                                        │
│                                                                             │
│     Para cada médico:                                                       │
│       1. DELETE FROM admin_dashboard_stats                                  │
│          WHERE doctor_code = X AND computed_at BETWEEN hoje 00:00 e 23:59   │
│       2. INSERT INTO admin_dashboard_stats (...)                            │
│                                                                             │
│     Resultado na tabela:                                                    │
│     ┌─────────────────────────────────────────────────────────────────┐     │
│     │ doctor_code │ doctor_name │ occupation_% │ clinics[]   │ ...   │     │
│     │─────────────│─────────────│──────────────│─────────────│───────│     │
│     │ 12345       │ Dr. Silva   │ 78.5 (HOJE)  │ {Lisboa,    │       │     │
│     │             │             │              │  Porto}     │       │     │
│     │             │             │              │  (30 DIAS)  │       │     │
│     └─────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  6. CALCULAR E GUARDAR clinic_stats                                         │
│                                                                             │
│     Para cada clínica única encontrada em todos os clinics[]:               │
│       - Agrupar médicos que têm essa clínica no array                       │
│       - total_doctors = count de médicos                                    │
│       - avg_occupation = média das occupation_percentage                    │
│       - total_reschedules = soma dos reschedules                            │
│                                                                             │
│       1. DELETE FROM clinic_stats WHERE clinic = X AND computed_at = hoje   │
│       2. INSERT INTO clinic_stats (...)                                     │
│                                                                             │
│     Resultado na tabela:                                                    │
│     ┌─────────────────────────────────────────────────────────────────┐     │
│     │ clinic   │ total_doctors │ avg_occupation_% │ total_reschedules │     │
│     │──────────│───────────────│──────────────────│───────────────────│     │
│     │ Lisboa   │ 5             │ 78.2             │ 23                │     │
│     │ Porto    │ 3             │ 82.5             │ 15                │     │
│     └─────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  7. RETORNAR RESPOSTA                                                       │
│                                                                             │
│     {                                                                       │
│       success: true,                                                        │
│       message: "Processed X doctors",                                       │
│       stats: [...]                                                          │
│     }                                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## O Que Aparece na Admin Dashboard (localhost)

### Cenário ATUAL: Sem médicos na tabela user_profiles

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ADMIN DASHBOARD                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Filtros: [Todas as clínicas ▼] [Todos os médicos ▼]                        │
│           (ambos dropdowns vazios - não há dados)                           │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Total       │  │ Ocupação    │  │ Reagend.    │  │ Ocupação    │         │
│  │ Médicos     │  │ Média       │  │ (30d)       │  │ Mensal      │         │
│  │     0       │  │   0%        │  │     0       │  │   0%        │         │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                                             │
│  Ocupação por Médico:                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │                                                                 │        │
│  │  ⚠️ Nenhum dado disponível.                                     │        │
│  │  As estatísticas são atualizadas automaticamente às 7h.         │        │
│  │                                                                 │        │
│  └─────────────────────────────────────────────────────────────────┘        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Cenário FUTURO: Com médicos e dados

Após adicionar médicos e executar a Edge Function:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ADMIN DASHBOARD                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Filtros: [Todas as clínicas ▼] [Todos os médicos ▼]                        │
│                                                                             │
│  Dropdown "Clínicas" mostrará:                                              │
│    - Lisboa                                                                 │
│    - Porto                                                                  │
│    - Coimbra                                                                │
│    - ... (todas as clínicas extraídas dos appointments)                     │
│                                                                             │
│  Dropdown "Médicos" mostrará:                                               │
│    - Dr. João Silva (12345)                                                 │
│    - Dr. Maria Santos (67890)                                               │
│    - ... (todos os médicos com dados)                                       │
│                                                                             │
│  Cards mostrarão valores reais calculados                                   │
│  Lista de médicos ordenada por occupation_percentage                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Tabelas Envolvidas

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           user_profiles                                     │
│                     (schema: appointments_app)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ id (uuid, FK auth.users) │ full_name    │ role   │ doctor_code              │
│──────────────────────────│──────────────│────────│──────────────────────────│
│ abc-123...               │ Dr. Silva    │ doctor │ 12345         ← PRECISA  │
│ def-456...               │ Admin User   │ admin  │ NULL          ← IGNORADO │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Edge Function lê médicos com doctor_code
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        admin_dashboard_stats                                │
│                     (schema: appointments_app)                              │
│                                                                             │
│  NOTA: clinics[] e service_codes[] = últimos 30 dias                        │
│        occupation_percentage, total_slots, occupied_slots = SÓ HOJE         │
├─────────────────────────────────────────────────────────────────────────────┤
│ doctor_code │ doctor_name │ occupation_% │ clinics[]      │ service_codes[] │
│─────────────│─────────────│──────────────│────────────────│─────────────────│
│ 12345       │ Dr. Silva   │ 78.5         │ {Lisboa,Porto} │ {436,440}       │
│ 67890       │ Dr. Santos  │ 72.0         │ {Coimbra}      │ {500}           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Edge Function agrega por clínica
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            clinic_stats                                     │
│                     (schema: appointments_app)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ clinic   │ total_doctors │ avg_occupation_% │ total_reschedules_30d │       │
│──────────│───────────────│──────────────────│───────────────────────│       │
│ Lisboa   │ 5             │ 78.2             │ 23                    │       │
│ Porto    │ 3             │ 82.5             │ 15                    │       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## APIs do Frontend

| Endpoint | Descrição | Usado por |
|----------|-----------|-----------|
| `GET /api/dashboard/filters` | Retorna clínicas e médicos únicos | Dropdowns de filtro |
| `GET /api/dashboard/stats?all=true` | Retorna stats de todos os médicos | Admin dashboard |
| `GET /api/dashboard/stats?all=true&clinic=Lisboa` | Filtra por clínica | Filtro de clínica |
| `GET /api/dashboard/clinic-stats` | Retorna stats agregadas por clínica | (disponível, não usado na UI) |

---

## Verificação de Problemas

### Edge Function (index.ts) - SEM PROBLEMAS

O código está correto:
- Processamento paralelo de médicos (batches de 10)
- Processamento paralelo de dias (batches de 5)
- clinics[] e service_codes[] agregados de 30 dias
- occupation_percentage calculado só para hoje
- Tratamento de erros em cada nível
- Delays para evitar rate limiting

### Potenciais Problemas de Runtime (não de código)

1. **Se não houver médicos em user_profiles:**
   - Edge Function retorna `{ success: true, message: "No doctors to process", count: 0 }`
   - Dashboard mostra "Nenhum dado disponível"
   - Filtros ficam vazios

2. **Se um médico não tiver appointments nos últimos 30 dias:**
   - clinics[] será `[]` (array vazio)
   - service_codes[] virá apenas da HR API
   - Médico não aparecerá em nenhum filtro de clínica

3. **Se um médico não tiver slots hoje:**
   - occupation_percentage = 0
   - total_slots = 0
   - occupied_slots = 0

---

## Para Testar Agora (localhost)

1. **Admin Dashboard** (`/admin-dashboard`):
   - Verifica que os dropdowns aparecem (vazios)
   - Verifica que os cards mostram 0
   - Verifica que a mensagem "Nenhum dado disponível" aparece

2. **API de Filtros** (`/api/dashboard/filters`):
   - Deve retornar `{ clinics: [], doctors: [] }`

3. **API de Stats** (`/api/dashboard/stats?all=true`):
   - Deve retornar `{ stats: [], isAdmin: true, filters: { clinic: null } }`

Quando adicionares médicos e executares a Edge Function, estes endpoints começarão a retornar dados reais.
