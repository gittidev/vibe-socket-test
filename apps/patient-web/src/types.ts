export type {
  Patient,
  VitalUpdate,
  AlertThresholds,
  Severity,
  AlertItem,
  AlertEvent,
  AlertResolvedEvent,
} from '@packages/shared-types';

import { AlertThresholds } from '@packages/shared-types';

export type RulesResponse = {
  default: AlertThresholds;
  wards: Record<string, AlertThresholds>;
  patients: Record<string, AlertThresholds>;
};
