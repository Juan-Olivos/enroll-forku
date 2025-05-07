class SystemLoadingError extends Error {
  constructor(message) {
    super(message);
    this.name = "SystemLoadingError";
  }
}

function UsedDuoCodeException(message) {
  this.name = "UsedDuoCodeException";
  this.message = message || "This DUO code has already been used before. Please use a new one.";
}

UsedDuoCodeException.prototype = Object.create(Error.prototype);
UsedDuoCodeException.prototype.constructor = UsedDuoCodeException;


module.exports = {
  SystemLoadingError,
  UsedDuoCodeException
};