import type { PickTextFileResult } from './pickTextFile';

/** Browser variant of {@link pickTextFile}: a hidden file input, with the size checked before reading. */
export function pickTextFile({ maxBytes }: { maxBytes: number }): Promise<PickTextFileResult> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json,text/plain';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve({ status: 'cancelled' });
        return;
      }

      if (file.size > maxBytes) {
        resolve({ status: 'tooLarge' });
        return;
      }

      const reader = new FileReader();
      reader.onload = () =>
        resolve({ status: 'picked', text: String(reader.result ?? ''), name: file.name });
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    };

    // Browsers fire `cancel` instead of `change` when the dialog is dismissed.
    input.oncancel = () => resolve({ status: 'cancelled' });
    input.click();
  });
}
