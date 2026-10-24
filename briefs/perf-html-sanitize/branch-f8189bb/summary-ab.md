| Item | KB | Before: pair at e70c30b (run 1 / 2) | After: shipped pair (run 1 / 2) | Saving (mean) | Same process: frozen 0ac6cfa pair → shipped pair | Open before → after |
|---|---:|---:|---:|---:|---:|---|
| gmail-5k | 5 | 1.58 / 1.85 | 0.81 / 0.85 | **0.89 ms (52 %)** | 1.77 → 0.83 (53 %) | 1.89 → 1.01 |
| outlook-5k | 7 | 3.82 / 4.11 | 2.53 / 2.44 | **1.48 ms (37 %)** | 3.96 → 2.49 (37 %) | 4.45 → 2.96 |
| outlook-54k | 56 | 37.24 / 34.40 | 21.05 / 21.52 | **14.54 ms (41 %)** | 36.03 → 21.28 (41 %) | 39.26 → 24.68 |
| legacy-table-54k | 53 | 48.42 / 47.43 | 28.13 / 30.40 | **18.66 ms (39 %)** | 46.32 → 29.26 (37 %) | 52.11 → 33.45 |
| newsletter-120k | 120 | 91.90 / 91.18 | 51.54 / 55.92 | **37.81 ms (41 %)** | 91.84 → 53.73 (41 %) | 98.91 → 61.00 |
| newsletter-unique-120k | 134 | 101.97 / 99.09 | 73.69 / 84.76 | **21.31 ms (21 %)** | 99.30 → 79.22 (20 %) | 108.89 → 87.74 |
| outlook-300k | 302 | 206.06 / 198.17 | 119.91 / 119.81 | **82.26 ms (41 %)** | 201.36 → 119.86 (40 %) | 221.16 → 138.79 |
| newsletter-300k | 301 | 227.13 / 241.33 | 134.32 / 130.76 | **101.69 ms (43 %)** | 231.49 → 132.54 (43 %) | 251.79 → 149.45 |

Single-mode sanitizeHtmlForDisplay(block) (route/calendar path), mean of runs: before → after
| gmail-5k | 0.90 → 0.84 |
| outlook-5k | 2.02 → 1.66 |
| outlook-54k | 17.02 → 12.66 |
| legacy-table-54k | 23.80 → 16.86 |
| newsletter-120k | 45.32 → 31.16 |
| newsletter-unique-120k | 50.67 → 49.71 |
| outlook-300k | 100.14 → 74.39 |
| newsletter-300k | 113.00 → 78.55 |
base1 2026-10-23T16:52:06.409Z diff: 72 inputs 0 mismatches 42 skips load 6.6 → 7.3
after1 2026-10-23T16:53:39.470Z diff: 72 inputs 0 mismatches 42 skips load 7.3 → 7.1
after2 2026-10-23T16:55:16.784Z diff: 72 inputs 0 mismatches 42 skips load 7.2 → 13.1
base2 2026-10-23T16:56:36.649Z diff: 72 inputs 0 mismatches 42 skips load 12.7 → 12.2
