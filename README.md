# DermaVision AI

**Medical image segmentation with EfficientSAM-Ti: a React clinical dashboard and a cross-modality benchmark study (dermoscopy, chest X-ray, brain MRI).**

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Vite](https://img.shields.io/badge/Vite-React-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.0%2B-EE4C2C?logo=pytorch&logoColor=white)](https://pytorch.org/)
[![Model](https://img.shields.io/badge/Model-EfficientSAM--Ti-blue)](https://github.com/yformer/EfficientSAM)
[![Status](https://img.shields.io/badge/Status-Research%20Only-yellow)](#disclaimer)

> **Research and educational use only.** This project is not a medical device and must not be used for diagnosis or patient care. See the [Disclaimer](#disclaimer).

---

## Overview

DermaVision AI has two parts:

1. **Clinical interface** – a Vite + React web app. Users upload a skin image, and a FastAPI backend (Google Colab or a local GPU, exposed through ngrok) returns a lesion mask, cropped patch, isolated lesion, and morphological metrics.
2. **Benchmark study** – an empirical comparison of zero-shot transfer vs. decoder-only fine-tuning of **EfficientSAM-Ti** on three modalities: dermoscopy (ISIC 2018), chest X-ray (Montgomery/Shenzhen), and brain MRI (BraTS 2020).

## Contents

- [Architecture](#architecture)
- [Model](#model)
- [Part 1: Web Client](#part-1-web-client)
- [Part 2: Benchmark Study](#part-2-benchmark-study)
- [Training Workflow](#training-workflow)
- [Backend Setup](#backend-setup)
- [Output Artifacts](#output-artifacts)
- [Repository Structure](#repository-structure)
- [Limitations](#limitations)
- [References](#references)
- [Disclaimer](#disclaimer)

---

## Architecture

<img width="1362" height="921" alt="image" src="https://github.com/user-attachments/assets/4166fc7b-b5e7-44c9-8780-42dcac0e4083" />


## Model

| Property | Value |
| --- | --- |
| Backbone | EfficientSAM-Ti (ViT-Tiny) |
| Total parameters | 10,223,204 (~10.22M) |
| Trainable (decoder) | 4,058,340 (~4.06M) |
| Frozen (encoder) | ~6.16M |
| Loss | Binary soft-Dice |
| Input resolution | 256 × 256 |
| Latency | ~127–146 ms per image/slice (NVIDIA Tesla T4) |

The encoder is frozen throughout; only decoder weights are updated during domain adaptation.

---

## Part 1: Web Client

### Features

- **Health check** – polls the backend root (`/`) to confirm the API is reachable.
- **Uploads** – PNG, JPG, JPEG, WebP, up to 10 MB.
- **Visual output** – original image, colour-coded mask overlay, cropped lesion patch, isolated lesion.
- **Morphological metrics** – area, perimeter, border compactness, asymmetry, hue variation, predicted IoU.
- **Export** – client-side download of every derived image.

### Installation

**Prerequisites:** Node.js 18+ and npm 9+.

```bash
node --version
npm --version

git clone https://github.com/ashmisn/skinlesion-medico.git
cd skinlesion-medico
npm install
```

### Configuration

Create a `.env` file in the project root (see `.env.example`):

```env
VITE_API_BASE_URL=https://your-ngrok-tunnel-url.ngrok-free.dev
```

Use no trailing slash. Whenever the Colab runtime or ngrok URL changes, update this value and restart the dev server.

### Run

```bash
npm run dev
```

Open <http://localhost:5173>.

### API Contract

`POST /segment` accepts a multipart file field named `file`. The frontend validates the response against:

```json
{
  "overlay": "data:image/png;base64,...",
  "cropped_patch": "data:image/png;base64,...",
  "isolated_lesion": "data:image/png;base64,...",
  "metrics": {
    "area_px": 14250.0,
    "perimeter_px": 482.3,
    "border_compactness": 0.770,
    "asymmetry_score": 0.124,
    "hue_variation": 0.043,
    "iou_score": 0.912
  },
  "empty_mask": false,
  "input_resolution": "256x256"
}
```

`GET /` returns `{"status": "connected", "model": "EfficientSAM-Ti"}`.

### Metric Definitions

| Metric | Meaning |
| --- | --- |
| Area (px²) | Pixel count of the segmented lesion. |
| Perimeter (px) | Length of the outer contour. |
| Border compactness | `4π · Area / Perimeter²`. Equals 1.0 for a perfect circle; lower values indicate a more irregular border. |
| Asymmetry score | Reflection-based mismatch across the major and minor axes. |
| Hue variation | Colour variance in HSV space inside the mask. |
| Predicted IoU | Model-estimated intersection-over-union of the mask. |

### Troubleshooting

| Symptom | Fix |
| --- | --- |
| "Backend disconnected" / `Failed to fetch` | Confirm the Colab runtime is active, the ngrok tunnel has not expired, and `VITE_API_BASE_URL` has no trailing `/`. |
| CORS errors | Ensure FastAPI uses `CORSMiddleware` (e.g. `allow_origins=["*"]` for development). |
| 500 / invalid JSON | Check Colab logs for out-of-memory errors during inference. |

---

## Part 2: Benchmark Study

### Datasets

| Modality | Target | Dataset | Preprocessing |
| --- | --- | --- | --- |
| Dermoscopy | Skin lesion boundary | ISIC 2018 Task 1 | 256×256 resize, RGB normalisation |
| Chest X-ray | Bilateral lung fields | Montgomery & Shenzhen CXR | PNG conversion, left/right mask union |
| Brain MRI | Glioma tumour tissue | BraTS 2020 | Axial 2D slices from 3D FLAIR NIfTI; only tumour-positive slices kept |

### Protocol

Each modality was evaluated under two conditions:

- **Zero-shot** – pretrained weights, no adaptation.
- **Fine-tuned** – decoder-only training for 3 epochs with Dice loss. Trainable parameter count is identical (4,058,340) across all experiments for a controlled comparison.

### Results

| Modality | Zero-shot Dice | Fine-tuned Dice | Zero-shot IoU | Fine-tuned IoU | Latency (T4) |
| --- | --- | --- | --- | --- | --- |
| Skin lesions (ISIC) | 0.8655 | **0.9344** | 0.7714 | **0.8794** | 145.85 ms |
| Chest X-ray (CXR) | 0.8741 | **0.9607** | 0.7831 | **0.9253** | 143.31 ms |
| Brain MRI (BraTS) | 0.6982 | **0.8107** | 0.5488 | **0.6899** | 127.11 ms |

### Key Findings

- **Chest X-ray is best after tuning** (0.9607 Dice / 0.9253 IoU), consistent with the strong contrast at lung–rib boundaries.
- **Brain MRI gains the most from adaptation:** +0.1125 Dice and +0.1411 IoU (absolute, i.e. +11.25 and +14.11 percentage points), indicating decoder-only tuning can bridge much of the natural-image-to-grayscale-MRI gap.
- **Dermoscopy** improves by +0.0689 Dice and +0.1080 IoU.
- **Latency is similar across modalities** (~127–146 ms on a T4).

---

## Training Workflow

### Colab setup

```bash
git clone https://github.com/yformer/EfficientSAM.git
cd EfficientSAM
pip install -q torch torchvision opencv-python matplotlib numpy pillow pandas nibabel
```

The ViT-Ti checkpoint (`weights/efficient_sam_vitt.pt`) ships with the EfficientSAM repository. Only the ViT-S checkpoint (`efficient_sam_vits.pt.zip`) needs unzipping.

### Decoder-only fine-tuning

```python
import torch
from efficient_sam.build_efficient_sam import build_efficient_sam_vitt

device = "cuda" if torch.cuda.is_available() else "cpu"
model = build_efficient_sam_vitt().to(device)

# Freeze everything except decoder parameters
for name, param in model.named_parameters():
    param.requires_grad = "decoder" in name.lower()

trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
print(f"Trainable parameters: {trainable:,}")
assert trainable == 4_058_340
```

---

## Backend Setup

Run the FastAPI server in Colab and expose it with `pyngrok`:

```python
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pyngrok import ngrok
import uvicorn

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def health_check():
    return {"status": "connected", "model": "EfficientSAM-Ti"}

@app.post("/segment")
async def segment_image(file: UploadFile = File(...)):
    # Read, preprocess, run inference, and return the API contract above
    ...

public_url = ngrok.connect(8000).public_url
print(f"Set in frontend .env: VITE_API_BASE_URL={public_url}")
uvicorn.run(app, host="0.0.0.0", port=8000)
```

> For anything beyond local development, restrict `allow_origins` to your frontend's origin.

---

## Output Artifacts

The evaluation pipeline writes the following to `PROJECT_DIR`:

| File | Description |
| --- | --- |
| `cross_modality_results.csv` | Metrics for all modalities and conditions. |
| `cross_modality_dice_iou.png` | Two-panel bar chart: zero-shot vs. fine-tuned Dice and IoU. |
| `cross_modality_speed.png` | Per-image/slice latency by modality. |
| `efficientsam_ti_xray_finetuned.pt` | Fine-tuned decoder weights (chest X-ray). |
| `efficientsam_ti_mri_finetuned.pt` | Fine-tuned decoder weights (brain MRI). |

---

## Repository Structure

```text
.
├── projectfrontend/               # Part 1: Vite + React client
│   ├── src/
│   │   ├── components/            # Dropzone, Metrics, Dashboard
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   ├── package.json
│   └── vite.config.js
├── notebooks/                     # Part 2: experiments
│   ├── efficientsam_skin.ipynb    # Dermoscopy pipeline (ISIC 2018)
│   └── efficientsamxray.ipynb     # Cross-modality study (CXR & BraTS)
├── .gitignore
└── README.md
```

---

<img width="1667" height="912" alt="image" src="https://github.com/user-attachments/assets/540eadb0-7809-4d12-9222-133350da0e0b" />
<img width="1675" height="920" alt="image" src="https://github.com/user-attachments/assets/d4ba2346-b079-4549-8b8e-756b1aff4b10" />
<img width="1660" height="911" alt="image" src="https://github.com/user-attachments/assets/89afd2e5-b8f7-4428-952c-f4564304c20e" />
<img width="1915" height="1007" alt="image" src="https://github.com/user-attachments/assets/501e3dfa-6339-438e-afcf-9832689f8415" />
<img width="1633" height="953" alt="image" src="https://github.com/user-attachments/assets/69be00be-ce31-408d-8d9c-1c1c6613c8c8" />





## Limitations

- Evaluation uses **2D slices** (including BraTS axial slices); no 3D volumetric context is modelled.
- Brain MRI uses only tumour-positive FLAIR slices, so results do not reflect performance on tumour-free slices.
- Fine-tuning was limited to 3 epochs, decoder-only; longer schedules or encoder adaptation were not explored.
- Latency figures are from a single GPU type (Tesla T4) and exclude network and ngrok overhead.
- Metrics are on the datasets listed above and may not generalise to other scanners, populations, or imaging protocols.

---

## References

1. Xiong, Y. et al. *EfficientSAM: Leveraged Light-weight Segment Anything Model.* [github.com/yformer/EfficientSAM](https://github.com/yformer/EfficientSAM)
2. Codella, N. et al. *Skin Lesion Analysis Toward Melanoma Detection: A Challenge at the 2018 International Symposium on Biomedical Imaging (ISBI).*
3. Jaeger, S. et al. *Two public chest X-ray datasets for computer-aided screening of pulmonary diseases.* Quantitative Imaging in Medicine and Surgery.
4. Menze, B. H. et al. *The Multimodal Brain Tumor Image Segmentation Benchmark (BRATS).* IEEE Transactions on Medical Imaging.

## License

Add a license (e.g. MIT) before publishing. Note that the datasets and the EfficientSAM weights have their own license terms.

## Author

Ashmi SN – [@ashmisn](https://github.com/ashmisn)

---

## Disclaimer

**For research and educational purposes only.**

This software and its fine-tuned checkpoints are not medical devices, clinical diagnostic tools, or automated triage systems. They have not been cleared by any regulatory authority and must not be used to diagnose melanoma, assess pulmonary pathology, guide oncology treatment, or direct patient care.
