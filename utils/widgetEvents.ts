/**
 * Event emitter for widget updates.
 * This breaks circular dependencies between database services and widget helpers.
 */

type Listener = () => void;

const listeners: Set<Listener> = new Set();
const resetListeners: Set<Listener> = new Set();

export const widgetEvents = {
  onReset(listener: Listener): () => void {
    resetListeners.add(listener);
    return () => {
      resetListeners.delete(listener);
    };
  },

  emitReset(): void {
    resetListeners.forEach((listener) => listener());
  },
  /**
   * Subscribe to nutrition widget update events.
   * Returns an unsubscribe function.
   */
  onNutritionWidgetUpdate(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /**
   * Emit a nutrition widget update event.
   * Called by services after modifying nutrition data.
   */
  emitNutritionWidgetUpdate(): void {
    listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error('Error in widget update listener:', error);
      }
    });
  },
};
