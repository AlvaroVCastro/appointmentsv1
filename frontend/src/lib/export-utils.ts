import * as XLSX from 'xlsx';

interface DoctorExportData {
  doctor_code: string;
  doctor_name: string | null;
  monthly_occupation_percentage: number | null;
  total_reschedules_30d: number;
}

/**
 * Exporta dados dos médicos para ficheiro Excel
 * Colunas: Numero de Medico | Nome do Medico | Ocupação Mensal (%) | Reagendamentos (30d)
 */
export function exportDoctorsToExcel(data: DoctorExportData[], filename?: string): void {
  // Formatar dados para o Excel
  const excelData = data.map((doctor) => ({
    'Numero de Medico': doctor.doctor_code,
    'Nome do Medico': doctor.doctor_name || 'Desconhecido',
    'Ocupação Mensal (%)': doctor.monthly_occupation_percentage !== null
      ? doctor.monthly_occupation_percentage.toFixed(1)
      : '-',
    'Reagendamentos (30d)': doctor.total_reschedules_30d,
  }));

  // Criar workbook e worksheet
  const worksheet = XLSX.utils.json_to_sheet(excelData);

  // Ajustar largura das colunas
  const columnWidths = [
    { wch: 18 }, // Numero de Medico
    { wch: 30 }, // Nome do Medico
    { wch: 20 }, // Ocupação Mensal
    { wch: 20 }, // Reagendamentos
  ];
  worksheet['!cols'] = columnWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Médicos');

  // Gerar nome do ficheiro com data actual
  const today = new Date().toISOString().split('T')[0];
  const finalFilename = filename || `medicos_ocupacao_${today}.xlsx`;

  // Fazer download
  XLSX.writeFile(workbook, finalFilename);
}
