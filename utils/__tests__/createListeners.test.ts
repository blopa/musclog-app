import { createListeners } from '../createListeners';

describe('createListeners', () => {
  it('notifies every subscriber', () => {
    const { subscribe, notify } = createListeners();
    const a = jest.fn();
    const b = jest.fn();
    subscribe(a);
    subscribe(b);

    notify();

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('stops notifying after unsubscribe, and unsubscribing twice is safe', () => {
    const { subscribe, notify } = createListeners();
    const a = jest.fn();
    const unsubscribe = subscribe(a);

    unsubscribe();
    unsubscribe();
    notify();

    expect(a).not.toHaveBeenCalled();
  });

  it('survives a listener unsubscribing during notify', () => {
    const { subscribe, notify } = createListeners();
    const b = jest.fn();
    const unsubscribeA = subscribe(() => unsubscribeA());
    subscribe(b);

    expect(() => notify()).not.toThrow();
    expect(b).toHaveBeenCalledTimes(1);

    notify();

    expect(b).toHaveBeenCalledTimes(2);
  });

  it('keeps separate stores independent', () => {
    const one = createListeners();
    const two = createListeners();
    const a = jest.fn();
    one.subscribe(a);

    two.notify();

    expect(a).not.toHaveBeenCalled();
  });
});
