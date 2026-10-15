# DermaVision AI Frontend

DermaVision AI is a Vite + React frontend for a skin-lesion segmentation workflow that sends images to a FastAPI backend running in Google Colab and exposed through ngrok.

This frontend helps you:

- Upload a skin-lesion image
- Check backend connectivity
- Run segmentation inference
- View the segmentation overlay, cropped region, and isolated lesion
- Review six image-derived measurements
- Download the generated image outputs

This project is for research and educational use only. It is not a medical diagnostic tool.

## Requirements

Install:

- Node.js 18 or newer
- npm

You can verify the versions with:

```bash
node --version
npm --version
```

## Install dependencies

From the project root:

```bash
npm install
```

## Configure the API URL

Create a `.env` file in the project root using the example below:

```env
VITE_API_BASE_URL=https://negation-confider-scribble.ngrok-free.dev
```

A starter file is already included as `.env.example`.

If your Colab or ngrok URL changes, update `VITE_API_BASE_URL` and restart the Vite server.

## Run the frontend

```bash
npm run dev
```

After changing `.env`, restart the Vite development server so the new environment value is loaded.

Open the local URL printed by Vite in the terminal.

## How to use the app

1. Confirm the backend shows a Connected status.
2. Upload a PNG, JPG, JPEG, or WebP image (max 10 MB).
3. Click `Run Full Analysis`.
4. Review the three generated output images and six metrics.
5. Download each result image individually.

## Expected JSON contract

The backend segmentation endpoint should return a JSON object like the following:

```json
{
  "overlay": "data:image/png;base64,...",
  "cropped_patch": "data:image/png;base64,...",
  "isolated_lesion": "data:image/png;base64,...",
  "metrics": {
    "area_px": 0,
    "perimeter_px": 0,
    "border_compactness": 0,
    "asymmetry_score": 0,
    "hue_variation": null,
    "iou_score": 0
  },
  "empty_mask": false,
  "input_resolution": "256x256"
}
```

The frontend validates the image fields, metric object, `empty_mask`, and `input_resolution` before rendering results.

## Metric interpretation

The six metric cards display values returned by the backend:

- Segmented Area: area in square pixels
- Boundary Perimeter: lesion boundary length in pixels
- Border Compactness: dimensionless calculated value
- Asymmetry Score: image-derived reflection comparison
- Hue Variation: HSV hue variation within the mask
- Segmentation IoU Score: model-predicted IoU

If a value is missing or `null`, the app displays `N/A`.

These values are research measurements only and do not diagnose disease or estimate cancer risk.

## Backend troubleshooting

If the app cannot connect:

- Verify the Colab runtime is still running.
- Confirm ngrok is still active and the URL has not expired.
- Check that the backend is serving JSON on the root endpoint.
- Make sure the app is using the current `VITE_API_BASE_URL`.
- Restart the Vite app after any `.env` change.

<img width="1800" height="968" alt="image" src="https://github.com/user-attachments/assets/8b30c449-5f7a-41f2-8723-27c40a16ad6c" />

<img width="1091" height="910" alt="image" src="https://github.com/user-attachments/assets/c48988e5-2575-4709-9b1b-8193393bc3b6" />

Common issues:

- CORS: The backend must allow requests from the browser's local Vite port.
- Timeout: The Colab runtime may be idle or overloaded.
- Invalid JSON: The server may have crashed or stopped responding correctly.
- Old PNG-only API: If the endpoint returns an image instead of JSON, the backend likely still uses the older endpoint format.
- Expired ngrok URL: Update `.env` and restart the frontend.

## Research-only disclaimer

For research and educational use only. This application does not diagnose melanoma, determine whether a lesion is cancerous, or provide clinical recommendations.

## Backend connection and Colab notes

The frontend checks the health endpoint at `/` and then calls `/segment` with a multipart form field named `file`.

The Colab server must remain running while the frontend is using the API. Saved checkpoints can remain on Google Drive, but the running model and in-memory server are not preserved after the runtime is stopped.
