## Main App — Estado atual (frontend) e onde entra o Reschedule

Este documento é um mapa do que existe hoje no frontend e como encaixar a feature de reschedule.

### O que já existe hoje (sinais fortes no código)
#### `frontend/src/lib/glintt-api.ts`
Responsabilidades atuais (alto nível):
- Autenticação (token)
- Fetch de appointments via GET `/Hms.OutPatient.Api/hms/outpatient/Appointment`
- Fetch de slots via `ExternalSearchSlots` (reschedule atualmente não está implementado aqui)
- Pipeline para construir “grid” de slots e cruzar com appointments
- Helpers para “dedup” e “merge slots with appointments”

Nota:
- A implementação atual já tem uma base muito boa: faz GET `/Appointment` e tem estrutura de dados para appointments/slots.

#### `frontend/src/lib/appointment-utils.ts`
Responsabilidades atuais:
- Transformar a resposta do schedule em estrutura consumida pela UI (`ScheduleSlot`)
- Lógica de agregação de slots vazias (“merged empty blocks”), com regras de:
  - barreira de almoço
  - fim do dia
  - mudança de dia
  - cálculo de `durationMinutes` e `endDateTime`

Isto é diretamente relevante para reschedule porque:
- o utilizador vai clicar num “bloco vazio”
- precisamos validar se o bloco tem duração suficiente
- precisamos respeitar “start at beginning”

#### `frontend/src/hooks/use-schedule.ts`
Responsabilidades atuais:
- Carregar schedule para um doctor num range (usa `/api/glintt/schedule`)
- Guardar estado de slots, loading, erro, etc.

#### API routes (Next.js)
Local:
- `frontend/src/app/api/glintt/*`

Já existe:
- `/api/glintt/schedule` (carrega slots+appointments para a UI)

### O que falta para Reschedule
Para reschedule completo precisamos adicionar:
1) API call para obter slots “rescheduláveis” (RescheduleFlag=true + episode)
2) API call para executar reschedule (ExternalScheduleAppointment com RescheduleFlag=true + Episode)
3) API route no Next.js para encapsular chamadas Glintt e manter token server-side
4) UI/estado para “modo reschedule”

### Requisito crítico: empty block maior do que o appointment
Quando o utilizador escolhe um “empty block” com duração total maior do que a marcação:
- o reschedule deve ocupar apenas o tempo necessário no início do bloco
- o restante deve continuar visível como vazio após refresh

Como garantimos isto sem “inventar slots”?
- O Glintt trabalha em slots base (tipicamente 30m). O reschedule precisa “pintar” o início do bloco:
  - appointment 60m = 2 slots de 30m
  - conciliated block 90m = 3 slots de 30m, etc.
- Depois de executar o reschedule, ao fazer refresh do schedule:
  - o Glintt devolve os 2 slots iniciais como ocupados (`S`)
  - e devolve os restantes como livres (`N`)
  - a nossa lógica de merge em `appointment-utils.ts` vai continuar a agregar o que restar, mostrando “15:00-16:00” como vazio.

### Conciliated blocks (move_entire_block)
Decisão já tomada:
- mover o bloco inteiro como unidade

Implicação técnica:
- se o bloco for representado por múltiplos appointments base, executar reschedule em sequência:
  - appointment A -> targetStart
  - appointment B -> targetStart + 30m
  - ...

### Observação importante para implementação
O `appointmentId` deve vir de GET `/Appointment`, e não da resposta do schedule/reschedule POST.
Portanto, a UI e o backend route devem trabalhar sempre com:
- `appointmentId` conhecido (do source appointment)
- e verificação/refresco por GET `/Appointment` após operação




