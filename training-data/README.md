# Rep Counting ML Training

This directory is a self-contained training pipeline for counting exercise reps
from WT901 BLE IMU recordings. It builds a segment classifier from manually
marked `repMarkers`, exports the model to JavaScript, and includes browser/video
tools for labeling and reviewing recordings.

For the full architecture and algorithm notes, see `DOCUMENTATION.md`.

## Setup

```bash
cd training-data
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

From the repo root, `npm run pip-install` runs the same dependency install inside
`training-data/.venv`.

## Label Recordings

Training uses only recordings with `repMarkers`; total rep counts alone are not
enough for model training.

```bash
# Chart-only marker editor for raw-data/*.json
python generate-markers-html.py
# Open output/markers/index.html

# Video-synced marker editor for recordings/<uuid>/{*.json, *.mp4}
python generate-video-markers.py
# Open recordings/index.html

# Optional non-interactive review/export video
python generate-video-combined.py
# Writes recordings/<uuid>/combined.mp4
```

From the repo root, the matching shortcuts are `npm run generate-markers-html`,
`npm run generate-video-markers`, and `npm run generate-video-combined`.

The video tools share `video_recording_data.py` for source JSON/MP4 selection,
sample sorting, dead-reckoning, downsampling, and `startedAt` alignment. Generated
`combined.mp4` files are ignored when selecting the source video, so the combined
video generator can be run repeatedly.

After marking reps, copy the downloaded updated JSON into `raw-data/` before
training.

## Train

```bash
python train.py
```

This will:

1. Load `raw-data/*.json` files that contain non-empty `repMarkers`.
2. Build candidate rep segments and label them by marker overlap.
3. Train a balanced Random Forest classifier.
4. Run leave-one-recording-out evaluation.
5. Export `output/model.pkl`, `output/model.js`, `output/summary.txt`, and
   `output/sus_data.txt`.

From the repo root, `npm run update-reps-model` trains and then copies
`training-data/output/model.js` to `utils/repCountingModel.js`.

## Predict

```bash
python predict.py raw-data/deadlift.json
python predict.py raw-data/deadlift.json --json
```

## Download Recordings

```bash
python download_recordings.py
```

This fetches JSON files from the configured Google Drive folder into `raw-data/`,
replacing files with the same name while leaving local-only files untouched.

## Outputs

| File                             | Description                                  |
| -------------------------------- | -------------------------------------------- |
| `output/features.csv`            | Generated segment feature matrix             |
| `output/model.pkl`               | Trained Python model used by `predict.py`    |
| `output/model.js`                | JavaScript classifier for app integration    |
| `output/summary.txt`             | Evaluation report from the last training run |
| `output/sus_data.txt`            | Suspicious/noisy recording report            |
| `recordings/<uuid>/combined.mp4` | Optional video plus IMU chart overlay        |
