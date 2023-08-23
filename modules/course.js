class Course {
  constructor(courseCode) {
    this.courseCode = courseCode;
    this.cooldown = 0;
    this.state = "";
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
}

module.exports = Course;
