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

