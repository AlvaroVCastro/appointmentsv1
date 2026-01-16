## Glintt Test Harness (backend/glintt-tests)

### Localização
- `backend/glintt-tests/`

### O que é
Harness de teste (dev-only) para executar operações reais **apenas** no ambiente Glintt **TEST**.
Serve como “reference logic” para schedule/reschedule e verificação.

### Como está organizado
- `glintt_client.py`
  - client partilhado para autenticação e chamadas HTTP
  - operações principais:
    - `authenticate()` -> token
    - `search_slots(...)` -> POST `ExternalSearchSlots`
    - `schedule_appointment(...)` -> POST `ExternalScheduleAppointment` (schedule e reschedule)
    - `get_appointments(...)` -> GET `/Hms.OutPatient.Api/hms/outpatient/Appointment`
    - `find_appointment_by_time(...)` -> helper para verificação

- `glintt_schedule.py`
  - script manual de schedule (cria uma marcação nova)

- `glintt_reschedule.py`
  - script manual de reschedule (reagenda uma marcação existente)
  - aceita `--episode-id` (na prática, `appointmentId`)

- `run_tests.py`
  - runner end-to-end (auth + obter appointment + reschedule + verify + salvar JSON)

### Porque o harness falhava antes
Falha típica:
- “No available slots for scheduling”
  - esperado quando já existe marcação do run anterior e o slot original deixou de estar livre
- “Schedule succeeded but no appointmentID returned”
  - o POST de schedule nem sempre devolve `appointmentID` utilizável

### Ajuste que fizemos (test-only)
O runner foi adaptado para ser **idempotente** e focado em reschedule:
- autentica
- procura primeiro marcações existentes via GET `/Appointment` no intervalo
- se encontrar uma marcação do paciente:
  - usa `appointmentId` encontrado como `EpisodeID`
  - não tenta schedule
  - avança para reschedule
- se não encontrar:
  - tenta schedule
  - depois busca o `appointmentId` via GET `/Appointment` (matching paciente+hora)

### Evidência do último run
Ficheiro:
- `backend/glintt-tests/test_run_20251229_154356.json`

Resumo:
- appointment original: 14:00 (ID 2722845)
- appointment depois do reschedule verificado: 15:00 (ID 2722846)
- `foundAtNewTime: true`, `foundAtOldTime: false`

### Nota sobre repetições no terminal (“PHASE 5”, “TEST SUMMARY”)
Em alguns outputs de PowerShell foi observado texto repetido.
O JSON salvo pelo runner indica que o fluxo foi consistente; as repetições aparentam ser artefacto de output buffering/console, não duplicação lógica do runner.






