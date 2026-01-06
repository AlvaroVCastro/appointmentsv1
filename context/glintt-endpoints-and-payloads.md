## Glintt — Endpoints e Payloads (Schedule vs Reschedule)

Este documento captura os endpoints que estamos a usar e os campos que importam.
Objetivo: remover ambiguidade entre “schedule novo” e “reschedule”.

### 1) Token
**POST** `/Glintt.GPlatform.APIGateway.CoreWebAPI/token`
- Obtém `access_token` (Bearer)

### 2) Search Slots
**POST** `/Glintt.HMS.CoreWebAPI/api/hms/appointment/ExternalSearchSlots`

#### 2.1 Payload base (elementos relevantes)
- `ExternalMedicalActSlotsList[0]` contém o “pedido” principal:
  - `StartDate`, `EndDate`
  - `MedicalActCode`
  - `ServiceCode`
  - `HumanResourceCode` (doctor)
  - `RescheduleFlag`
  - `origin`

#### 2.2 Schedule (novo)
- `RescheduleFlag: false`
- Sem `episode` (ou com episode que não é o contexto de reschedule)
- Retorna slots com `OccupationReason.Code`:
  - `N` -> livre
  - `S` -> ocupado
  - `B` -> bloqueado

#### 2.3 Reschedule (reagendar)
- `RescheduleFlag: true`
- Obrigatório incluir contexto do episode:
  - `episode: { EpisodeType: "Consultas", EpisodeID: "<appointmentId>" }`

Isto faz com que o Glintt devolva slots válidos para reagendar aquela marcação específica.

### 3) Schedule / Reschedule appointment
**POST** `/Glintt.HMS.CoreWebAPI/api/hms/appointment/ExternalScheduleAppointment`

#### 3.1 Campos importantes
- `ScheduleDate`: datetime do slot selecionado
- `Duration`: duração do slot
- `BookingID`: id do slot (vem do `ExternalSearchSlots`)
- `Patient`: `{ PatientType, PatientID }`
- `ServiceCode`, `MedicalActCode`, `HumanResourceCode`
- `Origin`

#### 3.2 Schedule (novo)
Típico:
- `RescheduleFlag`: ausente ou `false`
- `FirstTime`: (depende do setup)
- `episode`: `{ EpisodeType: "Ficha-ID", EpisodeID: "<patientId>" }`

Nota crítica:
- A resposta deste endpoint pode **não** incluir `appointmentID` de forma confiável para o nosso fluxo.
- Por isso, o app/harness deve obter o `appointmentId` via GET `/Appointment`.

#### 3.3 Reschedule
Obrigatório:
- `RescheduleFlag: true`
- `Episode: { EpisodeType: "Consultas", EpisodeID: "<appointmentId>" }`

### 4) List / Verify appointments
**GET** `/Hms.OutPatient.Api/hms/outpatient/Appointment`

#### 4.1 Query params usados no app/harness
- `beginDate`
- `endDate`
- `doctorCode` (quando necessário)
- `serviceCode` (quando necessário)
- `status` (ex: `SCHEDULED`)
- `skip`, `take`

#### 4.2 Campos relevantes na resposta
Exemplo real (campos importantes):
- `appointmentId` (fonte de verdade do ID)
- `appointmentHour` (datetime real da marcação)
- `duration`
- `doctorCode`
- `status`
- `patientIdentifier.id`
- `parentVisit.id` e `parentVisit.type` (usado como “episode” noutros contextos)

### 5) Regra operacional “source of truth”
Para qualquer implementação robusta:
- O `appointmentId` deve vir de GET `/Appointment`
- O reschedule deve ser verificado via GET `/Appointment` (nova hora existe e antiga deixa de existir)




