# EduLabs AI Local 3D Worker

This optional worker runs on your own PC.

Flow:

Website -> Vercel API -> Your PC worker -> TripoSR -> GLB model

Users do not install anything. Only the owner running the AI server needs this.

## Setup

1. Install Python 3.10+
2. Install TripoSR
3. Install requirements
4. Start the worker:

`python server.py`

Then set the Vercel environment variable:

`TRIPOSR_ENDPOINT=http://YOUR-PC-IP:8000/generate`

If the worker is offline, the website should fall back to demo mode.
