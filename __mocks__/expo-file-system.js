// Manual mock for `expo-file-system` — a native module, so its real implementation
// cannot load in Jest. Suites that actually assert on filesystem behaviour override this
// with their own `jest.mock('expo-file-system', ...)` factory; this stub exists so that
// merely importing a module which touches the filesystem does not fail a whole suite.

class File {
  constructor(...segments) {
    this.uri = segments.filter(Boolean).join('/');
    this.exists = false;
    this.size = 0;
  }
  create = jest.fn();
  delete = jest.fn();
  open = jest.fn();
  text = jest.fn(() => '');
  write = jest.fn();
}

class Directory {
  constructor(...segments) {
    this.uri = segments.filter(Boolean).join('/');
    this.exists = false;
  }
  create = jest.fn();
  delete = jest.fn();
  list = jest.fn(() => []);
}

module.exports = {
  Directory,
  File,
  FileMode: { Append: 'a', ReadOnly: 'r', ReadWrite: 'rw', WriteOnly: 'w' },
  Paths: {
    cache: new Directory('file:///cache'),
    document: new Directory('file:///document'),
    join: (...segments) => segments.filter(Boolean).join('/'),
  },
};
