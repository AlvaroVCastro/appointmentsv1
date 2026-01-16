## Contexto (Malo-Clinicv1) — Reschedule Glintt

Este diretório existe para dar ao Claude Code (e a qualquer dev) o máximo contexto possível **antes** de começar a mexer no código.

### Objetivo atual
Estamos a configurar e validar **apenas** a lógica de **reschedule** (reagendar) no Glintt **TEST environment**.
- Não é feature de produto “final”; é integração/validação e adaptação de harness (test-only).
- O lead forneceu lógica de referência em `backend/glintt-tests/`.

### Facto-chave (fonte do appointmentId)
O `appointmentId` **não pode ser assumido como vindo do schedule endpoint**.
No nosso caso, a “fonte de verdade” para obter `appointmentId` é:
- `GET /Hms.OutPatient.Api/hms/outpatient/Appointment`

### Regras essenciais do Reschedule (Glintt)
#### Search Slots (ExternalSearchSlots)
Para encontrar slots válidos para reagendar:
- `RescheduleFlag = true`
- incluir `episode = { EpisodeType: "Consultas", EpisodeID: <appointmentId> }`

#### Execute Reschedule (ExternalScheduleAppointment)
Para reagendar para um slot:
- `RescheduleFlag = true`
- incluir `Episode = { EpisodeType: "Consultas", EpisodeID: <appointmentId> }`
- `BookingID` vem do slot escolhido

### Problema observado no harness (e o porquê)
O runner antigo fazia sempre:
1) schedule de uma marcação nova
2) reschedule dessa marcação
3) verify

Falhava porque:
- “No available slots for scheduling” (a marcação já existia e a slot já não estava livre)
- ou “Schedule succeeded but no appointmentID returned” (schedule response sem id útil)

### Ajuste aplicado ao harness (resultado prático)
O runner foi ajustado para:
1) autenticar
2) **procurar primeiro marcações existentes via GET /Appointment**
3) se existir marcação para o paciente no range:
   - usar esse `appointmentId`
   - saltar schedule e ir direto ao reschedule
4) se não existir:
   - tentar schedule
   - depois obter `appointmentId` via GET /Appointment (matching por paciente+hora)

### Evidência do reschedule bem sucedido
Run que passou (ficheiro gerado pelo runner):
- `backend/glintt-tests/test_run_20251229_154356.json`

Valores observados:
- Antes (appointment original): `2025-12-29T14:00:00` com `appointmentId=2722845`
- Depois (novo appointment verificado): `2025-12-29T15:00:00` com `appointmentId=2722846`
- Verificação confirmou:
  - existe na nova hora ✅
  - não existe na hora antiga ✅

Nota: `newAppointmentId` pode vir `null` no resultado do POST; o id real foi confirmado via GET /Appointment.

### Contexto crítico para o produto (main app): empty blocks / slots agregadas
No frontend nós agregamos slots vazias consecutivas em “empty blocks” (janelas vazias).
Quando reschedulamos um appointment para dentro de um “empty block”, é obrigatório:
- **começar sempre no início do bloco vazio**
- ocupar apenas o tempo necessário (duração do appointment/bloco)
- manter o restante tempo do bloco visível como vazio

Exemplo:
- Bloco vazio: 14:00-16:00 (4 x 30m)
- Appointment a mover: 60m
- Resultado esperado:
  - 14:00-15:00 fica ocupado (2 x 30m)
  - 15:00-16:00 continua vazio

Isto implica duas durações relevantes:
1) **duração do appointment/bloco** (mantém-se quando reschedula)
2) **granularidade/duração base dos slots** (tipicamente 30m no Glintt; às vezes aparecem slots de 60m)

### Conciliated blocks (blocos agregados de appointments)
Quando um paciente tem um “conciliated block” (múltiplos appointments consecutivos) e o objetivo é mover o bloco:
- suportar “move_entire_block”
- manter a duração total
- se o bloco for representado internamente como múltiplos appointments (ex: 2 x 30m):
  - reagendar sequencialmente no destino (14:00, 14:30, ...)
  - assim ocupamos só a parte inicial e preservamos o resto do empty block

### Onde está o plano de implementação do app
Plano detalhado dentro do repo:
- `plans/glintt-reschedule-implementation-plan.md`

Docs complementares (este diretório):
- `context/glintt-tests-harness.md`
- `context/glintt-endpoints-and-payloads.md`
- `context/main-app-current-architecture.md`






