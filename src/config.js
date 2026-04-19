// ─── CONFIGURATION ───────────────────────────────────────────────────────────
// 
// Fill in these two values to connect your Google Form responses.
// See sheets.js for detailed setup instructions.
//

export const SHEETS_CONFIG = {
  // The ID from your Google Sheet URL:
  // https://docs.google.com/spreadsheets/d/THIS_PART/edit
  SHEET_ID: '13lTa3h3qSkeaDmbNqZxKxJCVniC7FeI0tgBJLIwVSE0',

  // Your Google Cloud API key (with Sheets API enabled):
  API_KEY: 'AIzaSyATpWX4rXVrjmJp4egVoyDDH83SRlNtYbA',

  // The name of the sheet tab with form responses
  // (usually "Form Responses 1" or "Respuestas de formulario 1")
  SHEET_NAME: 'Hypertrophy Training Progress Log (respuestas)',
};

// ─── PROGRAM CONFIGURATION ──────────────────────────────────────────────────

export const PROGRAM = {
  A: {
    name: "Day A — Squat Focus",
    tag: "A",
    color: "#C8391E",
    colorLight: "#FEF2F0",
    exercises: [
      { name: "Barbell Back Squat", type: "Compound", method: "Linear", sets: 3, repRange: "6-10" },
      { name: "Barbell Flat Bench Press", type: "Compound", method: "Linear", sets: 3, repRange: "6-10" },
      { name: "Barbell Row", type: "Compound", method: "Linear", sets: 3, repRange: "8-12" },
      { name: "Lateral Raises", type: "Isolation", method: "Double", sets: 2, repRange: "10-15" },
      { name: "Tricep Pushdown", type: "Isolation", method: "Linear", sets: 2, repRange: "10-15" },
    ],
  },
  B: {
    name: "Day B — Hinge Focus",
    tag: "B",
    color: "#1A6BB5",
    colorLight: "#EEF5FC",
    exercises: [
      { name: "Romanian Deadlift", type: "Compound", method: "Linear", sets: 3, repRange: "8-12" },
      { name: "Incline Dumbbell Press", type: "Compound", method: "Double", sets: 3, repRange: "8-12" },
      { name: "Lat Pulldown", type: "Compound", method: "Linear", sets: 3, repRange: "8-12" },
      { name: "Dumbbell Curls", type: "Isolation", method: "Double", sets: 2, repRange: "10-15" },
      { name: "Face Pulls", type: "Isolation", method: "Linear", sets: 2, repRange: "15-20" },
    ],
  },
  C: {
    name: "Day C — Unilateral Focus",
    tag: "C",
    color: "#1A8A6E",
    colorLight: "#EDF8F5",
    exercises: [
      { name: "Bulgarian Split Squat", type: "Compound", method: "Double", sets: 3, repRange: "8-12" },
      { name: "Dumbbell Shoulder Press", type: "Compound", method: "Double", sets: 3, repRange: "8-12" },
      { name: "Cable Row", type: "Compound", method: "Linear", sets: 3, repRange: "8-12" },
      { name: "Incline Dumbbell Curl", type: "Isolation", method: "Double", sets: 2, repRange: "10-15" },
      { name: "Overhead Tricep Extension", type: "Isolation", method: "Double", sets: 2, repRange: "10-15" },
    ],
  },
};

export const PROGRESSION = {
  Linear: { compoundPct: 0.025, isolationPct: 0.05 },
  Double: { startReps: 10, targetReps: 15, restartReps: 6, dbIncrement: 2 },
};

export const BODY_PARAMS = {
  weight: 65,
  height: 1.74,
  age: 37,
  proteinTarget: 130,
  calorieTarget: 2600,
};
