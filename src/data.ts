import { Patient, VitalUpdate } from "./types.js";

const patients: Patient[] = [
  { id: "p001", name: "Kim, Jiwoo", ward: "ICU", bed: "1A" },
  { id: "p002", name: "Park, Minseo", ward: "ICU", bed: "1B" },
  { id: "p003", name: "Lee, Juhwan", ward: "ER", bed: "03" }
];

const latestVitals: Record<string, VitalUpdate | undefined> = {};

export function listPatients(): Patient[] {
  return patients;
}

export function getLatestVital(patientId: string): VitalUpdate | undefined {
  return latestVitals[patientId];
}

export function setLatestVital(update: VitalUpdate) {
  latestVitals[update.patientId] = update;
}

export function getPatient(patientId: string): Patient | undefined {
  return patients.find((p) => p.id === patientId);
}

