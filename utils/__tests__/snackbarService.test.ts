import {
  registerSnackbarService,
  unregisterSnackbarService,
  showSnackbar,
} from '../snackbarService';

describe('utils/snackbarService', () => {
  let mockSnackbarFunction: jest.Mock;
  let originalConsoleWarn: typeof console.warn;

  beforeEach(() => {
    // Reset the service state before each test
    unregisterSnackbarService();
    
    // Create a fresh mock function for each test
    mockSnackbarFunction = jest.fn();
    
    // Mock console.warn to verify fallback behavior
    originalConsoleWarn = console.warn;
    console.warn = jest.fn();
  });

  afterEach(() => {
    // Restore console.warn
    console.warn = originalConsoleWarn;
    // Clean up
    unregisterSnackbarService();
  });

  describe('registerSnackbarService', () => {
    it('should register a snackbar function', () => {
      registerSnackbarService(mockSnackbarFunction);

      showSnackbar('success', 'Test message');
      expect(mockSnackbarFunction).toHaveBeenCalledWith('success', 'Test message', undefined);
    });

    it('should replace previously registered function', () => {
      const firstFunction = jest.fn();
      const secondFunction = jest.fn();

      registerSnackbarService(firstFunction);
      registerSnackbarService(secondFunction);

      showSnackbar('error', 'Test');
      expect(firstFunction).not.toHaveBeenCalled();
      expect(secondFunction).toHaveBeenCalledWith('error', 'Test', undefined);
    });

    it('should allow registering the same function multiple times', () => {
      registerSnackbarService(mockSnackbarFunction);
      registerSnackbarService(mockSnackbarFunction);

      showSnackbar('success', 'Test');
      expect(mockSnackbarFunction).toHaveBeenCalledTimes(1);
    });
  });

  describe('unregisterSnackbarService', () => {
    it('should unregister the snackbar function', () => {
      registerSnackbarService(mockSnackbarFunction);
      unregisterSnackbarService();

      showSnackbar('success', 'Test message');
      expect(mockSnackbarFunction).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith('[Snackbar] Service not registered:', 'Test message');
    });

    it('should be safe to call when nothing is registered', () => {
      expect(() => unregisterSnackbarService()).not.toThrow();
    });

    it('should clear the registered function', () => {
      registerSnackbarService(mockSnackbarFunction);
      unregisterSnackbarService();
      registerSnackbarService(mockSnackbarFunction);

      showSnackbar('success', 'Test');
      expect(mockSnackbarFunction).toHaveBeenCalled();
    });
  });

  describe('showSnackbar', () => {
    describe('when service is registered', () => {
      beforeEach(() => {
        registerSnackbarService(mockSnackbarFunction);
      });

      it('should call registered function with success type', () => {
        showSnackbar('success', 'Operation successful');

        expect(mockSnackbarFunction).toHaveBeenCalledWith(
          'success',
          'Operation successful',
          undefined
        );
        expect(console.warn).not.toHaveBeenCalled();
      });

      it('should call registered function with error type', () => {
        showSnackbar('error', 'Something went wrong');

        expect(mockSnackbarFunction).toHaveBeenCalledWith(
          'error',
          'Something went wrong',
          undefined
        );
        expect(console.warn).not.toHaveBeenCalled();
      });

      it('should call registered function with options', () => {
        const options = {
          subtitle: 'Subtitle text',
          action: 'Retry',
          duration: 5000,
        };

        showSnackbar('error', 'Error message', options);

        expect(mockSnackbarFunction).toHaveBeenCalledWith('error', 'Error message', options);
      });

      it('should call registered function with partial options', () => {
        const options = {
          duration: 3000,
        };

        showSnackbar('success', 'Message', options);

        expect(mockSnackbarFunction).toHaveBeenCalledWith('success', 'Message', options);
      });

      it('should handle empty message', () => {
        showSnackbar('success', '');

        expect(mockSnackbarFunction).toHaveBeenCalledWith('success', '', undefined);
      });

      it('should handle long messages', () => {
        const longMessage = 'A'.repeat(1000);
        showSnackbar('error', longMessage);

        expect(mockSnackbarFunction).toHaveBeenCalledWith('error', longMessage, undefined);
      });
    });

    describe('when service is not registered', () => {
      it('should fall back to console.warn', () => {
        showSnackbar('success', 'Test message');

        expect(mockSnackbarFunction).not.toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalledWith('[Snackbar] Service not registered:', 'Test message');
      });

      it('should fall back to console.warn with error type', () => {
        showSnackbar('error', 'Error message');

        expect(console.warn).toHaveBeenCalledWith('[Snackbar] Service not registered:', 'Error message');
      });

      it('should fall back to console.warn even with options', () => {
        const options = { duration: 5000 };
        showSnackbar('success', 'Message', options);

        expect(console.warn).toHaveBeenCalledWith('[Snackbar] Service not registered:', 'Message');
        expect(mockSnackbarFunction).not.toHaveBeenCalled();
      });

      it('should not throw when called without registration', () => {
        expect(() => showSnackbar('success', 'Test')).not.toThrow();
      });
    });

    describe('registration lifecycle', () => {
      it('should work after registering and unregistering', () => {
        // Initially not registered
        showSnackbar('success', 'Message 1');
        expect(console.warn).toHaveBeenCalledTimes(1);

        // Register
        registerSnackbarService(mockSnackbarFunction);
        showSnackbar('success', 'Message 2');
        expect(mockSnackbarFunction).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledTimes(1); // Still 1, not incremented

        // Unregister
        unregisterSnackbarService();
        showSnackbar('success', 'Message 3');
        expect(mockSnackbarFunction).toHaveBeenCalledTimes(1); // Still 1
        expect(console.warn).toHaveBeenCalledTimes(2); // Now 2
      });

      it('should handle multiple register/unregister cycles', () => {
        const fn1 = jest.fn();
        const fn2 = jest.fn();

        registerSnackbarService(fn1);
        showSnackbar('success', 'Msg 1');
        expect(fn1).toHaveBeenCalledTimes(1);

        unregisterSnackbarService();
        showSnackbar('success', 'Msg 2');
        expect(console.warn).toHaveBeenCalled();

        registerSnackbarService(fn2);
        showSnackbar('success', 'Msg 3');
        expect(fn2).toHaveBeenCalledTimes(1);
        expect(fn1).toHaveBeenCalledTimes(1); // Still 1
      });
    });
  });
});
