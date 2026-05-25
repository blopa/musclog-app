#!/usr/bin/env python3
"""Download all JSON files from the shared Google Drive folder into recordings/."""

import os
import shutil
import tempfile

import gdown

FOLDER_ID = "1dtBGDm68UXQWdFa_P_ZU30_Tdffl4MEE"
FOLDER_URL = f"https://drive.google.com/drive/folders/{FOLDER_ID}"
DEST_DIR = os.path.join(os.path.dirname(__file__), "recordings")


def main():
    os.makedirs(DEST_DIR, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp_dir:
        print(f"Downloading from Google Drive folder {FOLDER_ID}...")
        gdown.download_folder(
            url=FOLDER_URL,
            output=tmp_dir,
            quiet=False,
            use_cookies=False,
        )

        downloaded = [f for f in os.listdir(tmp_dir) if f.endswith(".json")]
        if not downloaded:
            print("No JSON files found in the Drive folder.")
            return

        for filename in downloaded:
            src = os.path.join(tmp_dir, filename)
            dst = os.path.join(DEST_DIR, filename)
            shutil.copy2(src, dst)
            print(f"  {'Updated' if os.path.exists(dst) else 'Added'}: {filename}")

        print(f"\nDone. {len(downloaded)} JSON file(s) written to {DEST_DIR}/")


if __name__ == "__main__":
    main()
