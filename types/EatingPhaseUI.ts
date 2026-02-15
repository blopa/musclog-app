/**
 * UI-specific eating phase types for display purposes.
 * These map to the database EatingPhase types ('cut' | 'maintain' | 'bulk')
 * but use more user-friendly names for the UI.
 */
export type EatingPhaseUI = 'cutting' | 'maintenance' | 'bulking' | 'lean-bulk';

/**
 * Converts database EatingPhase to UI EatingPhaseUI
 */
export function convertEatingPhaseToUI(dbPhase: string): EatingPhaseUI {
  switch (dbPhase) {
    case 'cut':
      return 'cutting';
    case 'maintain':
      return 'maintenance';
    case 'bulk':
      return 'bulking';
    default:
      return 'maintenance';
  }
}

/**
 * Converts UI EatingPhaseUI to database EatingPhase
 */
export function convertEatingPhaseToDB(uiPhase: EatingPhaseUI): 'cut' | 'maintain' | 'bulk' {
  switch (uiPhase) {
    case 'cutting':
      return 'cut';
    case 'maintenance':
      return 'maintain';
    case 'bulking':
    case 'lean-bulk':
      return 'bulk';
    default:
      return 'maintain';
  }
}
