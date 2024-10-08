class Course {
  constructor(catalogCode) {
    this.catalogCode = catalogCode;
    this.cooldown = 0;
    this.state = "";
    this.name = "";
  }

  reformatState() {
    if (this.state.includes("Available")) {
      this.state = "Available";
    } else if (this.state.includes("Full")) {
      this.state = "Full";
    } else {
      this.state = "ERROR";
    }
  }

  applyEnrollmentCooldown() {
    this.cooldown = 180;
  }

  getFullDescription() {
    return `${this.name} (${this.catalogCode})`;
  }
}

module.exports = Course;
