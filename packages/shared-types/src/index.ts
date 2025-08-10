export type Patient = {
  id: string;
  name: string;
  ward?: string;
  bed?: string;
};

export type VitalUpdate = {
  patientId: string;
  hr: number;
  sbp: number;
  dbp: number;
  spo2: number;
  temp: number;
  rr: number;
  timestamp: number; // epoch ms
};

export type AlertThresholds = {
  hrHigh?: number; hrLow?: number;
  sbpHigh?: number; sbpLow?: number;
  spo2Low?: number;
  tempHigh?: number;
  rrHigh?: number; rrLow?: number;
};

export type Severity = 'warning' | 'critical';
export type AlertItem = { key: string; message: string; severity: Severity };
export type AlertEvent = { patientId: string; alerts?: string[]; items?: AlertItem[]; timestamp: number };
export type AlertResolvedEvent = { patientId: string; resolved: string[]; keys: string[]; timestamp: number };

