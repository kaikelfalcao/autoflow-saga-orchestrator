module.exports = {
  recordCustomEvent: () => {},
  getTransaction: () => ({
    insertDistributedTraceHeaders: () => {},
    acceptDistributedTraceHeaders: () => {},
  }),
  startBackgroundTransaction: (_name, fn) => fn(),
};
