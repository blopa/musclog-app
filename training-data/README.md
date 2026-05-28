# Rep Counting — ML Training

This directory is self-contained and independent from the main app. It trains a small model that predicts rep counts from motion sensor recordings, then exports it to JavaScript for future app integration.

## Setup (one time)

```bash
cd training-data

# Create a virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

## Train

```bash
python train.py
```

This will:

1. Load all labeled recordings from `raw-data/` and `labels.csv`
2. Extract signal features from each JSON file
3. Train two models (Random Forest and Gradient Boosting) and compare them
4. Print a leave-one-out cross-validation report for both
5. Export the better model to `output/model.js` (JavaScript) and `output/model.pkl` (Python)

## Predict on a new recording

```bash
python predict.py raw-data/deadlift.json
```

## Downloading recordings from Google Drive

```bash
python download_recordings.py
```

This fetches all JSON files from the shared Google Drive folder and writes them into `raw-data/`, replacing any existing files with the same name. Local-only files are left untouched.

## Adding new recordings

1. Copy the JSON file into `raw-data/`
2. Re-run `python train.py`

The trainer reads `reps`, `muscleGroup`, `equipmentType`, and `mechanicType` directly from each JSON. No CSV needed. Files without a `reps` field are skipped with a warning.

More recordings = better model. Aim for at least 5–10 per exercise type, with variety in cadence and rep count.

## Output files

| File                  | Description                                              |
| --------------------- | -------------------------------------------------------- |
| `output/features.csv` | Extracted feature matrix — useful for debugging          |
| `output/model.pkl`    | Trained model for use by `predict.py`                    |
| `output/model.js`     | Same model as a JS function — for future app integration |
| `output/summary.txt`  | Evaluation report from the last training run             |

## How it works

Each JSON recording is summarized into 15 numbers (features):

| Feature                 | What it captures                                     |
| ----------------------- | ---------------------------------------------------- |
| `duration_ms`           | Total recording length                               |
| `sample_rate_hz`        | Sensor sampling frequency                            |
| `dominant_range_deg`    | How much the main angle axis moves                   |
| `nondominant_range_deg` | The other angle axis                                 |
| `drift_ratio`           | Gyroscope drift (high for deadlifts)                 |
| `peak_count`            | Peaks detected in the angle signal                   |
| `valley_count`          | Valleys detected                                     |
| `median_half_amp_deg`   | Typical peak-to-valley distance                      |
| `std_half_amp_deg`      | Variability of rep amplitudes                        |
| `dominant_freq_hz`      | Main oscillation frequency (FFT)                     |
| `freq_est_reps`         | Frequency × duration (rep count estimate)            |
| `zero_crossing_count`   | Zero crossings ≈ 2 × rep count for clean signals     |
| `accel_z_range`         | Vertical acceleration range (key for cable machines) |
| `accel_z_peak_count`    | Peaks in vertical acceleration                       |
| `is_angle_flat`         | 1 if angle barely moves (cable/stack machine)        |
| `set_number`            | Which set in the exercise (higher → more fatigue)    |

A Random Forest or Gradient Boosting model (both are just decision trees under the hood) learns to map these features to a rep count. No GPU needed — training takes a few seconds on any laptop.
