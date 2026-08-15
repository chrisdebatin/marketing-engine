/**
 * Test-Peppers. Wird per --import geladen, damit die Werte gesetzt sind,
 * BEVOR ein Testmodul crypto.ts importiert (statische Imports werden gehoisted).
 */
process.env.EMPLOYEE_CODE_PEPPER ||= "test-pepper-fuer-codes-mindestens-16";
process.env.EMPLOYEE_SESSION_PEPPER ||= "test-pepper-fuer-sessions-mind-16";
