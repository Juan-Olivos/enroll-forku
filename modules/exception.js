class SystemLoadingError extends Error {
  constructor(message) {
    super(message);
    this.name = "SystemLoadingError";
  }
}

module.exports = {
  SystemLoadingError,
};