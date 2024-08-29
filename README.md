# enroll-forku

A tool to automate checking course availability and enrollment. Now working for Fall/Winter 2024-2025!

## How It Works

This tool automates the process of checking course availability and enrolling in courses. Here's a step-by-step breakdown of its functionality:

1. **Course Availability Check**: The script interacts with the Visual Schedule Builder (VSB) every 5 minutes to check if the specified courses are available.
2. **Enrollment**: If a course is available, the script navigates to the Registration and Enrollment Module (REM) and automatically enrolls you into the course.
3. **Reserved Courses**: If enrollment fails due to the seats being reserved, the course will be placed on a 3-hour cooldown to prevent spamming REM with enrollment attempts.

**Please note:** Spamming REM/VSB can result in being temporarily banned from these services. Use at your own risk.

## Prerequisites

Before you begin, ensure you have met the following requirements:
- You have installed [Node.js](https://nodejs.org/) (version 18.17.1 or higher)
- You have a terminal or command line interface

## Installation

To install the dependencies, follow these steps:

1. Clone the repository
    ```bash
    git clone https://github.com/Juan-Olivos/enroll-forku.git
    ```
2. Navigate to the project directory
    ```bash
    cd enroll-forku
    ```
3. Install the required packages
    ```bash
    npm install
    ```

## Configuration

1. Create a `.env` file in the root directory of the project.
2. Add the following environment variables to the `.env` file:

    ```plaintext
    PPY_USERNAME=your_username
    PPY_PASSWORD=your_password
    ```
3. (Optional) To enable email notifications upon successful enrollment, add these additional variables:

    ```plaintext
    EXTERNAL_GMAIL=your_gmail_address
    GMAIL_APP_PASSWORD=your_app_password
    ```

   To obtain a Gmail App Password:
   - Go to your Google Account settings (https://myaccount.google.com/)
   - Select "Security" on the left navigation panel
   - Enable 2-Step Verification if it's not already enabled
   - Go back to Security and look up "App passwords" on the search bar at the top of the page
   - Give your app password a name
   - Click "Create"
   - Use the 16-character password that Google generates as your GMAIL_APP_PASSWORD

If email notifications are not configured, the script will still run without sending notifications.

## Usage

To run the script, use the following command:

```bash
node index.js
```

When prompted, enter the course catalog codes separated by a space:
```plaintext
Please enter the course catalog codes separated by a space: ABC123 XYZ456
```
Replace ABC123 XYZ456 with the actual course catalog codes you want to enroll in.

You will need to manually Two-factor authenticate for the initial login.
